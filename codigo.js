// codigo.js — CRION busca de alta precisão (index local, mínima alucinação) - VERSÃO SCORING + CORREÇÃO URL

/* ========= UF: sigla ↔ nome (com e sem acento) ========= */
const UF_MAP = {
  ac:["acre","ac"],
  al:["alagoas","al"],
  ap:["amapa","amapá","ap"],
  am:["amazonas","am"],
  ba:["bahia","ba"],
  ce:["ceara","ceará","ce"],
  df:["distrito federal","df","brasilia","brasília","brasilia df","brasília df"],
  es:["espirito santo","espírito santo","es"],
  go:["goias","goiás","go"],
  ma:["maranhao","maranhão","ma"],
  mt:["mato grosso","mt"],
  ms:["mato grosso do sul","ms"],
  mg:["minas gerais","mg"],
  pa:["para","pará","pa"],
  pb:["paraiba","paraíba","pb"],
  pr:["parana","paraná","pr"],
  pe:["pernambuco","pe"],
  pi:["piaui","piauí","pi"],
  rj:["rio de janeiro","rj"],
  rn:["rio grande do norte","rn"],
  rs:["rio grande do sul","rs"],
  ro:["rondonia","rondônia","ro"],
  rr:["roraima","rr"],
  sc:["santa catarina","sc"],
  sp:["sao paulo","são paulo","sp","capital sp","sp capital"],
  se:["sergipe","se"],
  to:["tocantins","to"]
};
/* ========= CIDADES e aliases (com/sem acento, hífen, cedilha) ========= */
const CITY_ALIASES = {
  "sao cristovao":[
    "são cristovao","sao cristovão","são cristovão",
    "s.cristovao","s cristovao","sao-cristovao","s cristovão","s.cristovão"
  ],
  "sao bernardo":[
    "são bernardo","s bernardo","s.bernardo","sao-bernardo","sao bernado","samp" // SAMP = linha São Bernardo (ES)
  ],
  "sao jose dos campos":[ "sjc","s jose dos campos","s.jose dos campos","são josé dos campos" ],
  "belo horizonte":[ "bh" ],
  "rio de janeiro":[ "rj capital","rio" ],
  "sao paulo":[ "são paulo","sp capital","sampa" ],
  "porto alegre":[ "poa" ],
  "cuiaba":[ "cuiabá" ],
  "goiania":[ "goiânia" ],
  "joao pessoa":[ "joão pessoa" ],
  "tres lagoas":[ "três lagoas" ],
  "mossoro":[ "mossoró" ],
  "uberlandia":[ "uberlândia" ],
  "ribeirao preto":[ "ribeirão preto" ],
  "vitoria de santo antao":[ "vitória de santo antão" ],
  "maranhao":[ "ma" ],
  "amazonas":[ "am" ],
  "sergipe":[ "se" ],
  "pernambuco":[ "pe" ],
  "para":[ "pará","pa" ]
};
/* ========= Token especial que “força” UF/cidade ========= */
const SPECIAL_CITY_TOKENS = {
  // “samp” no nome/consulta indica linha São Bernardo no ES
  "samp": { city:"sao bernardo", uf:"es" }
};
/* ========= Normalização (remove acento, til, cedilha etc.) ========= */
const STOP = new Set(["de","da","do","das","dos","e","a","o","as","os","the"]);
const norm = s => String(s||"")
  .toLowerCase()
  .normalize("NFD")                 // separa acentos
  .replace(/\p{Diacritic}/gu,"")    // remove acentos (ã→a, ç→c)
  .replace(/[._]/g," ")
  .replace(/\s+/g," ")
  .trim();

const tokenize = s => norm(s)
  .replace(/[-/]/g," ")             // hífen/barra viram espaço
  .replace(/[^\p{Letter}\p{Number}\s]/gu," ")
  .split(/\s+/)
  .filter(t=>t && !STOP.has(t));
/* ========= Marcas/domínios ========= */
const BRAND_DOMAINS = { affix:"affix.com.br", alter:"alter.com.br" };
const detectBrands = qn => ({ hasAffix:/\baffix\b/i.test(qn), hasAlter:/\balter\b/i.test(qn) });
/* ========= Data no nome → boost ========= */
function extractMY(nameN){
  const m = nameN.match(/[-_](0[1-9]|1[0-2])[-_](\d{2})(?=($|[^0-9]))/);
  return m ? {year:2000+ +m[2], month:+m[1]} : null;
}
const dateScore = item => { const my=extractMY(item.nameN); return my? my.year*12+my.month : 0; };
/* ========= Helpers de match ========= */
const wordsSlug   = s => ` ${tokenize(s).join(" ")} `;
const containsWord   = (slug,t)=> slug.includes(` ${t} `);
const containsPhrase = (slug,phrase)=>{
  const p = tokenize(phrase).join(" ");
  return p && slug.includes(` ${p} `);
};

/* UF forte: sigla isolada por não-letras (ex.: “-ES-”, “(ES)”) */
function hasUFStrong(raw, uf){
  const sig = uf.toUpperCase();
  const re = new RegExp(`(^|[^A-Za-z])${sig}([^A-Za-z]|$)`);
  return re.test(raw);
}
/* Regra extra: “ES-Manual” ou “Manual-ES” força ES */
function hasESManual(raw){
  return /(^|[^A-Za-z])ES([^A-Za-z].*manual|$)|manual[^A-Za-z].*ES([^A-Za-z]|$)/i.test(raw);
}
function passUFStrict(it, uf){
  if(!uf) return true;
  if(it.ufs.has(uf)) return true;
  if(uf==="es" && (hasESManual(it.nameRaw)||hasESManual(it.urlRaw))) return true;
  return hasUFStrong(it.nameRaw, uf) || hasUFStrong(it.urlRaw, uf);
}

/* ========= Indexação com Keywords do CSV (ATUALIZADO) ========= */
function buildIndex(rows){
  const seen=new Set(), out=[];
  for(const r of rows){
    // Verifica se a linha tem as 3 colunas esperadas (name, url, keywords)
    if(!r || !r.name || !r.url || typeof r.keywords === 'undefined') continue; // Pula linha mal formatada

    let url=String(r.url).trim();
    if(/^http:\/\//i.test(url)) url=url.replace(/^http:\/\//i,"https://"); // força https
    if(!/^https?:\/\/[^\s]+$/i.test(url)) continue; // Valida URL
    if(seen.has(url)) continue; seen.add(url); // Evita duplicatas pela URL

    const nameRaw = String(r.name);
    const urlRaw  = url;
    const keywordsRaw = String(r.keywords || ''); // Pega a string de keywords

    const nameN = norm(nameRaw);
    const urlN  = norm(urlRaw);
    const keywordsN = norm(keywordsRaw); // Normaliza as keywords também

    // O slug agora inclui palavras do nome, URL e keywords
    const slug  = wordsSlug(nameRaw + " " + urlRaw + " " + keywordsRaw); // Adiciona keywords ao slug

    // O conjunto kws agora inclui tokens do nome, URL e keywords
    const kws   = new Set([
      ...tokenize(nameRaw),
      ...tokenize(urlRaw),
      ...tokenize(keywordsRaw) // Adiciona tokens das keywords
    ]);

    // --- O restante da lógica de detecção de UFs e Cidades permanece igual ---
    const ufs=new Set();
    for(const [uf,alts] of Object.entries(UF_MAP)){
      const altsN=[uf, ...alts.map(norm)];
      // Verifica se algum alias da UF está no slug (que agora inclui keywords)
      if(altsN.some(a=>containsWord(slug,a))) ufs.add(uf);
      // Mantém a verificação forte na URL e Nome originais
      else if(hasUFStrong(nameRaw,uf) || hasUFStrong(urlRaw,uf)) ufs.add(uf);
    }
    if(hasESManual(nameRaw) || hasESManual(urlRaw)) ufs.add("es"); // Reforço ES-Manual

    const cities=new Set();
    for(const [base,alts] of Object.entries(CITY_ALIASES)){
      const all=[base, ...alts.map(norm)];
      // Verifica se algum alias da cidade está no slug (que agora inclui keywords)
      if(all.some(a=>containsPhrase(slug,a))) cities.add(base);
    }
    // --------------------------------------------------------------------

    // Adiciona o campo 'tags' (versão normalizada das keywords) ao objeto do índice
    out.push({
      name:r.name,
      url:urlRaw,
      nameN,
      urlN,
      slug,
      kws,
      ufs,
      cities,
      tags: new Set(tokenize(keywordsRaw)), // Guarda os tokens das keywords separadamente
      dscore:dateScore({nameN}),
      nameRaw,
      urlRaw
    });
  }
  return out;
}


/* ========= Expansão de consulta (UF/cidade/aliases/tokens) ========= */
function expandQuery(q){
  const qn    = norm(q);
  const parts = tokenize(qn);

  // Detecta UF e considera “apenas UF” se todos tokens são aliases dessa UF
  let uf=null;
  for(const [k,alts] of Object.entries(UF_MAP)){
    const aliasTokens = new Set([k, ...alts.flatMap(a=>tokenize(a))]);
    const allFromUF   = parts.length>0 && parts.every(t=>aliasTokens.has(t));
    if(allFromUF || alts.some(a=>qn.includes(norm(a)))){ uf=k; break; }
  }
  if(uf){
    const aliasTokens = new Set([uf, ...UF_MAP[uf].flatMap(a=>tokenize(a))]);
    if(parts.every(t=>aliasTokens.has(t))) return {terms:new Set([uf]), uf}; // ex.: “espirito santo”
  }

  // Lock por cidade se a frase aparece
  for(const [base,alts] of Object.entries(CITY_ALIASES)){
    const all=[base,...alts.map(norm)];
    if(all.some(a=>qn.includes(a))){
      const tset = new Set([...tokenize(base), ...(uf?[uf]:[])]);
      return {terms:tset, uf, cityLock:base};
    }
  }

  // Tokens especiais
  for(const [tok,rule] of Object.entries(SPECIAL_CITY_TOKENS)){
    if(parts.includes(tok)){
      const lockUF = uf || rule.uf;
      return {terms:new Set([tok, ...tokenize(rule.city), lockUF]), uf:lockUF, cityLock:rule.city};
    }
  }

  // Expansão leve: se algum token for alias de cidade, adiciona base
  const extra=[];
  for(const [base,alts] of Object.entries(CITY_ALIASES)){
    const all = new Set([base,...alts.map(norm)]);
    for(const t of parts){ if(all.has(t)){ extra.push(base); break; } }
  }

  return {terms:new Set([...parts, ...extra, ...(uf?[uf]:[])]), uf};
}

/* ========= Busca Refinada com Scoring (ATUALIZADO) ========= */
function search(index, q) {
  if (!index?.length) return [];
  const qn = norm(q || ""); if (!qn) return [];
  const { hasAffix, hasAlter } = detectBrands(qn);
  const { terms, uf, cityLock } = expandQuery(q); // Obtém termos normalizados, UF e cidade (se houver)

  // Filtros básicos (marca, UF estrita, cidade específica)
  const brandFilter = hasAffix || hasAlter;
  const passBrand = it =>
    !brandFilter ||
    (hasAffix && it.url.includes(BRAND_DOMAINS.affix)) || // Verifica se URL contém o domínio da marca
    (hasAlter && it.url.includes(BRAND_DOMAINS.alter)); // Verifica se URL contém o domínio da marca
  const passCity = it => !cityLock || containsPhrase(it.slug, cityLock); // Verifica se slug contém a frase da cidade

  const results = [];
  for (const it of index) {
    // Aplica filtros iniciais
    if (!passBrand(it) || !passUFStrict(it, uf) || !passCity(it)) continue; // Pula se não passar nos filtros de marca, UF estrita ou cidade

    let score = 0;
    let matchedTermsCount = 0;
    const matchedInName = new Set();
    const matchedInUrl = new Set();
    // const matchedInTags = new Set(); // Descomentar se adicionar tags ao índice

    // 1. Match exato da frase (pontuação máxima)
    const exactMatch = it.nameN.includes(qn) || it.urlN.includes(qn); // Verifica se nome ou URL normalizado contém a query exata
    if (exactMatch) {
      score = 10000; // Pontuação muito alta para match exato
      matchedTermsCount = terms.size;
    } else {
      // 2. Pontuação baseada nos termos individuais
      terms.forEach(term => {
        let termFound = false;
        const termPattern = ` ${term} `; // Procura palavra inteira (com espaços)
        const termStartPattern = `${term} `;
        const termEndPattern = ` ${term}`;

        // Prioridade 1: Termo no nome ou URL (usando slug para verificar) ou KWS
        // Verifica se o termo está no slug (que inclui palavras do nome, URL e keywords)
        if (containsWord(it.slug, term)) { // Usa containsWord para verificar slug
           // Verifica especificamente no nome para dar mais peso
           if (it.nameN.includes(termPattern) || it.nameN.startsWith(termStartPattern) || it.nameN.endsWith(termEndPattern) || it.nameN === term) {
              score += 100; // Peso maior para match no nome
              matchedInName.add(term);
              termFound = true;
           }
           // Verifica na URL se não achou no nome (peso médio)
           else if (it.urlN.includes(termPattern) || it.urlN.includes(`/${term}/`) || it.urlN.endsWith(`/${term}`) || it.urlN.endsWith(`-${term}.pdf`)) { // Adiciona verificações na URL
              score += 50; // Peso menor para match na URL
              matchedInUrl.add(term);
              termFound = true;
           }
           // Adicionar lógica para tags aqui, se implementado
           // else if (it.tags && it.tags.has(term)) { score += 20; matchedInTags.add(term); termFound = true; }
        }

         // Mesmo se não for palavra inteira, verifica se o token está contido (peso baixo) - para siglas grudadas etc.
         if (!termFound && (it.kws.has(term))) { // Verifica se o token existe no conjunto de keywords
            score += 10; // Peso baixo para match parcial ou em kws
             // Tenta atribuir a nome ou url para desempate
             if (it.nameN.includes(term)) matchedInName.add(term);
             else if (it.urlN.includes(term)) matchedInUrl.add(term);
            termFound = true;
         }


        if (termFound) {
          matchedTermsCount++;
        }
      });

      // Boost se todos os termos foram encontrados
      if (matchedTermsCount === terms.size && terms.size > 0) {
        score += 500; // Bônus significativo por encontrar todos os termos
      }

       // Boost adicional se a UF específica foi encontrada E estava na query
      if (uf && it.ufs.has(uf)) { // Verifica se a UF do item bate com a UF da query
         score += 150;
      }
      // Boost adicional se a cidade específica foi encontrada E estava na query
       if (cityLock && it.cities.has(cityLock)) { // Verifica se a cidade do item bate com a cidade travada da query
          score += 200; // Boost maior para cidade
       }

      // Adiciona o score de data (boost leve para arquivos mais recentes)
      score += it.dscore / 50; // Ajuste o divisor para controlar o peso da data
    }

    // Adiciona aos resultados apenas se tiver pontuação
    if (score > 0) {
      results.push({
        it,
        score,
        matchedTermsCount,
        // debug: { nameM: [...matchedInName], urlM: [...matchedInUrl] } // Para depuração
      });
    }
  }

  // Ordena os resultados:
  // 1. Maior Score
  // 2. Maior número de termos encontrados
  // 3. Ordem alfabética do nome (desempate)
  return results
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.matchedTermsCount !== a.matchedTermsCount) return b.matchedTermsCount - a.matchedTermsCount;
      return a.it.name.localeCompare(b.it.name);
    })
    .map(x => ({ name: x.it.name, url: x.it.url /*, score: x.score */ })); // Retorna apenas nome e URL
}


/* ========= Carregamento CSV e Busca (Interface - Versão Scoring + Correção URL) ========= */
const AFFIX_CSV_URL = "data/affix/affix_pdfs_manifest.csv";
let AFFIX_PDFS = []; // Guarda os dados brutos parseados
let AFFIX_INDEX = []; // Guarda o índice construído

async function loadAffixCSV(){
  if (AFFIX_INDEX.length) return; // Só carrega e indexa uma vez
  const badge = $('#affixCount');
  badge.textContent = 'Carregando lista de PDFs...';
  try {
    const res = await fetch(AFFIX_CSV_URL);
    if (!res.ok) {
        badge.textContent = `Erro ${res.status} ao carregar CSV`;
        throw new Error(`HTTP error ${res.status}`);
    }
    const text = await res.text();
    AFFIX_PDFS = parseAffixCSV(text); // Parseia o CSV (espera 3 colunas)
    AFFIX_INDEX = buildIndex(AFFIX_PDFS); // Constrói o índice usando buildIndex (que espera 3 colunas)
    badge.textContent = `${AFFIX_INDEX.length} PDFs indexados.`;
  } catch (e) {
      badge.textContent = 'Erro ao carregar lista.';
      console.error("Falha no carregamento ou indexação do CSV:", e);
      // Não re-throw para permitir que o resto da UI funcione, mas avisa
  }
}

// Função para parsear CSV (ATUALIZADA para 3 colunas)
function parseAffixCSV(text){
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return []; // Precisa de cabeçalho + dados
  const out = [];
  // Assumindo cabeçalho: name,url,keywords
  for (let i=1; i<lines.length; i++){
    const line = lines[i].trim();
    if (!line) continue;

    // Lógica simples para separar por vírgula, tratando aspas se necessário (básico)
    const parts = [];
    let currentPart = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"' && (j === 0 || line[j - 1] !== '\\')) { // Trata aspas de forma simples
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            // Remove aspas das pontas APENAS se estiverem presentes
            const trimmedPart = currentPart.trim();
            parts.push(trimmedPart.startsWith('"') && trimmedPart.endsWith('"') ? trimmedPart.slice(1, -1) : trimmedPart);
            currentPart = '';
        } else {
            currentPart += char;
        }
    }
    // Adiciona a última parte
    const lastPartTrimmed = currentPart.trim();
    parts.push(lastPartTrimmed.startsWith('"') && lastPartTrimmed.endsWith('"') ? lastPartTrimmed.slice(1, -1) : lastPartTrimmed);


    // Espera 3 colunas: name, url, keywords
    if (parts.length === 3) {
      const [name, url, keywords] = parts;
      // Validação básica de URL
      if (name && url && url.toLowerCase().startsWith('http')) {
          out.push({ name, url, keywords: keywords || '' }); // Adiciona keywords ou string vazia
      } else {
          console.warn(`Linha ${i+1} ignorada: nome, URL inválida ou ausente. Conteúdo: ${line}`);
      }
    } else {
        console.warn(`Linha ${i+1} ignorada: formato CSV inesperado (esperado 3 colunas, encontrado ${parts.length}). Conteúdo: ${line}`);
    }
  }
  return out;
}


function toggleAffixPrev(i){
  const el = document.getElementById("affix_prev_" + i);
  if (!el) return;
  el.style.display = (el.style.display === "none" || !el.style.display) ? "block" : "none";
}

// Função googleViewerURL (CORRIGIDA - com trim e encodeURIComponent)
function googleViewerURL(fileUrl){
  const cleaned = String(fileUrl || '').trim(); // Garante que é string e limpa espaços
  if (!cleaned || cleaned === '#') return ''; // Retorna vazio se não houver URL válida
  return "https://docs.google.com/viewer?embedded=true&url=" + encodeURIComponent(cleaned); // Codifica corretamente
}


// Função searchAffixPDFs (ATUALIZADA para usar window.search e limpar URLs)
async function searchAffixPDFs(q){
  const list   = $('#affixList');
  const badge = $('#affixCount');
  try {
    await loadAffixCSV(); // Garante que o índice esteja carregado e construído
  } catch(e){
    // Erro já logado no loadAffixCSV
    return; // Interrompe se o carregamento falhar
  }

  const term = (q||'').toLowerCase().trim();

  // Usa a função search global (que agora tem scoring) passando o índice construído
  const results = window.search(AFFIX_INDEX, term); // Chama a função search principal com o índice

  badge.textContent = `${results.length} resultado(s)`;
  if(!results.length){ list.textContent='—'; return; }

  list.innerHTML = ''; // Limpa lista anterior
  let i = 0;
  function pump(){ // Adiciona resultados aos poucos
    const frag = document.createDocumentFragment();
    for(let k=0; k<10 && i<results.length; k++, i++){
      const r = results[i]; // 'r' aqui é o objeto { name, url } retornado pelo search
      const row = document.createElement('div');
      row.className = 'affix-row';

      // <<< CORREÇÃO URL APLICADA AQUI >>>
      // Limpa a URL ANTES de usá-la
      const cleanUrl = r.url ? String(r.url).trim() : '#';
      const viewerUrl = googleViewerURL(cleanUrl); // Chama com a URL limpa

      row.innerHTML =
        `<div><b>${esc(r.name)}</b></div>
         <div class="affix-actions">
           <button class="btn btn-plain" onclick="window.open('${cleanUrl}','_blank')" ${cleanUrl === '#' ? 'disabled' : ''}>Abrir</button>
           <button class="btn btn-plain" onclick="toggleAffixPrev(${i})" ${cleanUrl === '#' ? 'disabled' : ''}>Prévia</button>
         </div>
         <div id="affix_prev_${i}" class="affix-prev">
           ${viewerUrl ? // Only render iframe if viewerUrl is valid
             `<iframe
               src="${viewerUrl}"
               referrerpolicy="no-referrer"
               loading="lazy"></iframe>`
             : '<p style="padding: 20px; text-align: center; color: var(--muted);">Prévia indisponível.</p>'
           }
         </div>`;
       // <<< FIM DA CORREÇÃO >>>
      frag.appendChild(row);
    }
    list.appendChild(frag);
    if(i < results.length) requestAnimationFrame(pump);
  }
  pump();
}


/* ========= Outras Funções da Interface (Sites, CRION, Alerta, Feedback, Widgets - Mantidas) ========= */

// --- Funções do Google Apps Script (GAS) ---
const APP_URL = "https://script.google.com/macros/s/AKfycbzYHcP4jOPyTXuaWJiaLg1Gr5FP_G1mZNCwV33Se-PJ3wjFLjddwEN9fcRNJxBo2Df0ig/exec";
const $ = s => document.querySelector(s);
const show = (el, on=true)=>{ if(!el) return; el.style.display = on ? '' : 'none'; };
function esc(s){ return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
function cleanName(n){ return String(n||'').replace(/^(OCR_TMP_|TMP_SLIDES_)+/ig,''); }
function link(url, txt){ return `<a href="${url}" target="_blank" rel="noopener">${esc(txt||url)}</a>`; }
function humanSize(b){ if(!b||b<=0) return "—"; const u=["B","KB","MB","GB"]; let i=0; while(b>=1024&&i<u.length-1){ b/=1024; i++; } return b.toFixed(1)+" "+u[i]; }

function call(endpoint, payload){
  const url = APP_URL + "?fn=" + encodeURIComponent(endpoint);
  return fetch(url, {
    method:"POST",
    headers:{ "Content-Type":"text/plain" },
    body: JSON.stringify(payload || {})
  }).then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); });
}

// --- Widgets (Post-it / Calculadora) ---
function toggleNoteWrap(isCloseButton){
    const noteWrap = $('#noteWrap');
    const noteArea = $('#noteArea');
    const isVisible = noteWrap.style.display !== 'none';
    if (isCloseButton || isVisible) {
        show(noteWrap, false);
    } else {
        show(noteWrap, true);
        noteArea.focus();
    }
}
function clearNote() {
    const noteArea = $('#noteArea');
    noteArea.value=""; localStorage.removeItem('ric_note');
}

function toggleCalcWrap(isCloseButton){
    const calcWrap = $('#calcWrap');
    const isVisible = calcWrap.style.display !== 'none';
    if (isCloseButton || isVisible) {
        show(calcWrap, false);
    } else {
        show(calcWrap, true);
        refresh();
    }
}

const calc = { buf:"0", op:null, mem:0, fresh:true };
function refresh(){ $('#scr').textContent = calc.buf; }
function press(k){
  if(/\d/.test(k)){ calc.buf = (calc.fresh||calc.buf==="0")? k : calc.buf+k; calc.fresh=false; return refresh(); }
  if(k==="00"){ press("0"); press("0"); return; }
  if(k==="."){ if(!calc.buf.includes(".")) calc.buf += "."; calc.fresh=false; return refresh(); }
  if(k==="C"){ calc.buf="0"; calc.op=null; calc.fresh=true; return refresh(); }
  if(k==="±"){ if(calc.buf!=="0") calc.buf = calc.buf.startsWith("-")? calc.buf.slice(1):"-"+calc.buf; return refresh(); }
  if(k==="%"){ calc.buf = String(parseFloat(calc.buf)/100); return refresh(); }
  if("+-*/".includes(k)){ calc.mem=parseFloat(calc.buf); calc.op=k; calc.fresh=true; return; }
  if(k==="=" && calc.op){
    const a=calc.mem, b=parseFloat(calc.buf);
    let v=0; switch(calc.op){case "+":v=a+b;break;case "-":v=a-b;break;case "*":v=a*b;break;case "/":v=b===0? "Erro" : a/b;break;}
    calc.buf=String(v); calc.op=null; calc.fresh=true; return refresh();
  }
}

// --- Feedback ---
async function doFeedback(){
  const qFeedback = $('#qFeedback');
  const feedbackStatus = $('#feedbackStatus');
  const feedbackBusy = $('#feedbackBusy');
  const q = (qFeedback.value||'').trim();
  const placeholderText = qFeedback.placeholder;
  if(!q || q === placeholderText){ feedbackStatus.textContent='Por favor, digite sua mensagem.'; return; }
  show(feedbackBusy,true); feedbackStatus.textContent='Enviando...';
  try{
    const r = await call('savefeedback',{mensagem: q});
    if(!r || r.ok===false){ feedbackStatus.textContent='❌ Erro ao enviar: '+(r&&r.message?r.message:''); }
    else { feedbackStatus.textContent='✅ Feedback enviado com sucesso! Obrigado!'; qFeedback.value = ''; }
  }catch(e){ feedbackStatus.textContent='❌ Erro na comunicação: '+(e.message||e); }
  finally{ show(feedbackBusy,false); }
}

// --- Alerta ---
async function doAlerts(){
  const msg=$('#alertMsg'), resp=$('#alertResp');
  const alertBusy = $('#alertBusy');
  show(msg,false); show(resp,false); show(alertBusy,true);
  try{
    const r = await call('getalert',{});
    if(!r || r.ok===false){ msg.textContent="Falha ao consultar."; show(msg,true); return; }
    if(!r.found){ msg.textContent="Sem recado no momento."; show(msg,true); return; }
    msg.textContent = "🚨 " + String(r.mensagem||"—").toUpperCase(); show(msg,true);
    if(r.responsavel){ resp.textContent = String(r.responsavel||"").toLowerCase(); show(resp,true); }
  }catch(e){ msg.textContent="Erro: "+(e.message||e); show(msg,true); }
  finally{ show(alertBusy,false); }
}

// --- Busca nos Sites (OpenAI) ---
async function doSites(){
  const q=($('#qSites').value||'').trim();
  const sitesBusy = $('#sitesBusy');
  const outSites = $('#outSites');
  // Chama a busca local de PDFs (versão scoring + correção url)
  searchAffixPDFs(q);
  if(!q){ outSites.textContent='Digite a pergunta.'; return; }
  show(sitesBusy,true); outSites.textContent='—';
  try{
    const qRich = q + " — FORMATO: responda em português com texto útil e liste as URLs oficiais no final. Substitua observações por: 'Fontes oficiais Affix, Alter, Hapvida'.";
    const r = await call('chat',{q:qRich}); // Chama a API do GAS
    const txt = (r && r.text) ? r.text : '—';
    const html = String(txt).replace(/(https?:\/\/[^\s<]+)/g, m=>`<a href="${m}" target="_blank" rel="noopener">${m}</a>`);
    outSites.innerHTML = html;
  }catch(e){ outSites.textContent='Erro: '+(e.message||e); }
  finally{ show(sitesBusy,false); }
}

// --- Busca CRION (Procedimentos Indexados no GAS) ---
async function doCRION(){
  const q=($('#qCRION').value||'').trim();
  const crionStatus = $('#crionStatus');
  const crionList = $('#crionList');
  const crionBusy = $('#crionBusy');
  if(!q){ crionStatus.textContent='Digite um termo.'; return; }
  show(crionBusy,true); crionStatus.textContent='Listando arquivos…'; crionList.innerHTML="";
  try{
    const res = await call('searchcrion',{q}); // Chama API do GAS para buscar
    if(!res || res.ok===false){ crionStatus.textContent='Erro ao buscar: '+(res&&res.message?res.message:''); return; }
    const items=res.items||[]; crionStatus.textContent=`Resultados: ${items.length}`;
    const frag=document.createDocumentFragment();
    items.forEach((it,idx)=>{
      const li=document.createElement('li'); li.style.padding="10px 0"; li.style.borderTop="1px solid var(--line)"; li.id='crion_'+idx;
      const meta   = `<div class="hint">Tamanho: ${humanSize(it.size||0)} • Atualizado: ${it.updated? new Date(it.updated).toLocaleString(): "—"}</div>`;
      li.innerHTML=`<div><b>${esc(cleanName(it.name))}</b> • ${link(it.url,'Abrir')}</div>${meta}
                   <div class="hint" id="snip_crion_${idx}">Carregando prévias…</div>`;
      frag.appendChild(li);
    });
    crionList.appendChild(frag);
    if(items.length){
      let from=0;
      while(from < items.length){
        const r = await call('fetchcrionsnippets',{sessionId:res.sessionId, from, limit:6}); // Busca snippets
        (r.items||[]).forEach(row=>{
          const el=$('#snip_crion_'+row.index);
          el.innerHTML=(row.snippets && row.snippets.length)? row.snippets.map(s=>`<div style="color:#374151;margin:6px 0">${esc(s)}</div>`).join("") : '<span class="hint">—</span>';
        });
        from = r.to;
      }
      crionStatus.textContent += " • prévias completas";
    }
  }catch(e){ crionStatus.textContent='Erro: '+(e.message||e); }
  finally{ show(crionBusy,false); }
}

// --- Inicialização e Event Listeners ---
window.onload = function() {

    // Configuração dos botões principais
    $('#btnAlert').addEventListener('click', doAlerts);
    $('#btnSites').addEventListener('click', doSites);
    $('#btnCRION').addEventListener('click', doCRION);
    $('#btnFeedback').addEventListener('click', doFeedback);

    // Configuração dos Widgets (Post-it / Calculadora)
    $('#toggleNote').addEventListener('click', () => toggleNoteWrap(false));
    $('#closeNote').addEventListener('click', () => toggleNoteWrap(true)); // Passa true para indicar que é o botão fechar
    $('#clearNote').addEventListener('click', clearNote);

    $('#toggleCalc').addEventListener('click', () => toggleCalcWrap(false));
    $('#closeCalc').addEventListener('click', () => toggleCalcWrap(true)); // Passa true para indicar que é o botão fechar

    // Calculadora Key Presses
    const keys = $('#keys');
    if (keys) {
        keys.addEventListener('click', e => {
            const k = e.target.dataset.k;
            if(k) press(k);
        });
    }

    // Post-it Persistence
    const noteArea = $('#noteArea');
    if (noteArea) {
        noteArea.value = localStorage.getItem('ric_note') || "";
        noteArea.addEventListener('input', ()=> localStorage.setItem('ric_note', noteArea.value));
    }

    // Melhorias de UX (Enter nas buscas)
    const qSites = $('#qSites');
    const btnSites = $('#btnSites');
    if(qSites && btnSites) qSites.addEventListener('keydown', e=>{ if(e.key==='Enter') btnSites.click(); });

    const qCRION = $('#qCRION');
    const btnCRION = $('#btnCRION');
    if(qCRION && btnCRION) qCRION.addEventListener('keydown', e=>{ if(e.key==='Enter') btnCRION.click(); });

    // Helper para fechar widget
    function closeWidget(wrapId) {
       const el = document.getElementById(wrapId);
       if (el) el.style.display = 'none';
    }

    // Carrega a lista de PDFs ao iniciar (para agilizar a primeira busca - versão scoring + correção url)
    loadAffixCSV().catch(err => {
      // Erro já logado no console dentro da função
      $('#affixCount').textContent = 'Erro ao carregar lista.';
    });
};

/* ========= Export (browser global) - Mantido caso necessário ========= */
window.buildIndex = buildIndex;
window.search     = search;
