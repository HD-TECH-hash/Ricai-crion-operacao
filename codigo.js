// codigo.js — CRION busca de alta precisão (index local, mínima alucinação)

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
  "samp": { city:"sao bernardo", uf:"es" } // [cite: 603]
};
/* ========= Normalização (remove acento, til, cedilha etc.) ========= */
const STOP = new Set(["de","da","do","das","dos","e","a","o","as","os","the"]); // [cite: 604]
const norm = s => String(s||"")
  .toLowerCase() // [cite: 605]
  .normalize("NFD")                 // separa acentos [cite: 605]
  .replace(/\p{Diacritic}/gu,"")    // remove acentos (ã→a, ç→c) [cite: 605]
  .replace(/[._]/g," ") // [cite: 605]
  .replace(/\s+/g," ") // [cite: 605]
  .trim(); // [cite: 605]
const tokenize = s => norm(s)
  .replace(/[-/]/g," ")             // hífen/barra viram espaço [cite: 606]
  .replace(/[^\p{Letter}\p{Number}\s]/gu," ") // [cite: 606]
  .split(/\s+/) // [cite: 606]
  .filter(t=>t && !STOP.has(t)); // [cite: 606]
/* ========= Marcas/domínios ========= */
const BRAND_DOMAINS = { affix:"affix.com.br", alter:"alter.com.br" }; // [cite: 607]
const detectBrands = qn => ({ hasAffix:/\baffix\b/i.test(qn), hasAlter:/\balter\b/i.test(qn) }); // [cite: 607]
/* ========= Data no nome → boost ========= */
function extractMY(nameN){
  const m = nameN.match(/[-_](0[1-9]|1[0-2])[-_](\d{2})(?=($|[^0-9]))/); // [cite: 608]
  return m ? {year:2000+ +m[2], month:+m[1]} : null; // [cite: 609]
}
const dateScore = item => { const my=extractMY(item.nameN); return my? my.year*12+my.month : 0; }; // [cite: 609]
/* ========= Helpers de match ========= */
const wordsSlug   = s => ` ${tokenize(s).join(" ")} `; // [cite: 610]
const containsWord   = (slug,t)=> slug.includes(` ${t} `); // [cite: 611]
const containsPhrase = (slug,phrase)=>{
  const p = tokenize(phrase).join(" "); // [cite: 611]
  return p && slug.includes(` ${p} `); // [cite: 612]
};

/* UF forte: sigla isolada por não-letras (ex.: “-ES-”, “(ES)”) */
function hasUFStrong(raw, uf){
  const sig = uf.toUpperCase(); // [cite: 612]
  const re = new RegExp(`(^|[^A-Za-z])${sig}([^A-Za-z]|$)`); // [cite: 613]
  return re.test(raw); // [cite: 613]
}
/* Regra extra: “ES-Manual” ou “Manual-ES” força ES */
function hasESManual(raw){
  return /(^|[^A-Za-z])ES([^A-Za-z].*manual|$)|manual[^A-Za-z].*ES([^A-Za-z]|$)/i.test(raw); // [cite: 613]
}
function passUFStrict(it, uf){
  if(!uf) return true; // [cite: 614]
  if(it.ufs.has(uf)) return true; // [cite: 614]
  if(uf==="es" && (hasESManual(it.nameRaw)||hasESManual(it.urlRaw))) return true; // [cite: 614]
  return hasUFStrong(it.nameRaw, uf) || hasUFStrong(it.urlRaw, uf); // [cite: 614-615]
}

/* ========= Indexação com Keywords do CSV (ATUALIZADO) ========= */
function buildIndex(rows){
  const seen=new Set(), out=[]; // [cite: 615]
  for(const r of rows){
    // Verifica se a linha tem as 3 colunas esperadas (name, url, keywords)
    if(!r || !r.name || !r.url || typeof r.keywords === 'undefined') continue; // Pula linha mal formatada

    let url=String(r.url).trim(); // [cite: 616]
    if(/^http:\/\//i.test(url)) url=url.replace(/^http:\/\//i,"https://"); // força https [cite: 616]
    if(!/^https?:\/\/[^\s]+$/i.test(url)) continue; // Valida URL [cite: 617]
    if(seen.has(url)) continue; seen.add(url); // Evita duplicatas pela URL [cite: 617]

    const nameRaw = String(r.name); // [cite: 617]
    const urlRaw  = url; // [cite: 617]
    const keywordsRaw = String(r.keywords || ''); // Pega a string de keywords

    const nameN = norm(nameRaw); // [cite: 618]
    const urlN  = norm(urlRaw); // [cite: 618]
    const keywordsN = norm(keywordsRaw); // Normaliza as keywords também

    // O slug agora inclui palavras do nome, URL e keywords
    const slug  = wordsSlug(nameRaw + " " + urlRaw + " " + keywordsRaw); // Adiciona keywords ao slug [cite: 618]

    // O conjunto kws agora inclui tokens do nome, URL e keywords
    const kws   = new Set([
      ...tokenize(nameRaw), // [cite: 619]
      ...tokenize(urlRaw), // [cite: 619]
      ...tokenize(keywordsRaw) // Adiciona tokens das keywords
    ]);

    // --- O restante da lógica de detecção de UFs e Cidades permanece igual ---
    const ufs=new Set(); // [cite: 619]
    for(const [uf,alts] of Object.entries(UF_MAP)){ // [cite: 620]
      const altsN=[uf, ...alts.map(norm)]; // [cite: 620]
      // Verifica se algum alias da UF está no slug (que agora inclui keywords)
      if(altsN.some(a=>containsWord(slug,a))) ufs.add(uf); // [cite: 620]
      // Mantém a verificação forte na URL e Nome originais
      else if(hasUFStrong(nameRaw,uf) || hasUFStrong(urlRaw,uf)) ufs.add(uf); // [cite: 620]
    }
    if(hasESManual(nameRaw) || hasESManual(urlRaw)) ufs.add("es"); // Reforço ES-Manual [cite: 621]

    const cities=new Set(); // [cite: 621]
    for(const [base,alts] of Object.entries(CITY_ALIASES)){ // [cite: 622]
      const all=[base, ...alts.map(norm)]; // [cite: 622]
      // Verifica se algum alias da cidade está no slug (que agora inclui keywords)
      if(all.some(a=>containsPhrase(slug,a))) cities.add(base); // [cite: 622]
    }
    // --------------------------------------------------------------------

    // Adiciona o campo 'tags' (versão normalizada das keywords) ao objeto do índice
    out.push({
      name:r.name, // [cite: 623]
      url:urlRaw, // [cite: 623]
      nameN, // [cite: 623]
      urlN, // [cite: 623]
      slug, // [cite: 623]
      kws, // [cite: 623]
      ufs, // [cite: 623]
      cities, // [cite: 623]
      tags: new Set(tokenize(keywordsRaw)), // Guarda os tokens das keywords separadamente
      dscore:dateScore({nameN}), // [cite: 623]
      nameRaw, // [cite: 624]
      urlRaw // [cite: 624]
    });
  }
  return out; // [cite: 624]
}


/* ========= Expansão de consulta (UF/cidade/aliases/tokens) ========= */
function expandQuery(q){
  const qn    = norm(q); // [cite: 624]
  const parts = tokenize(qn); // [cite: 625]

  // Detecta UF e considera “apenas UF” se todos tokens são aliases dessa UF
  let uf=null; // [cite: 625]
  for(const [k,alts] of Object.entries(UF_MAP)){ // [cite: 626]
    const aliasTokens = new Set([k, ...alts.flatMap(a=>tokenize(a))]); // [cite: 626]
    const allFromUF   = parts.length>0 && parts.every(t=>aliasTokens.has(t)); // [cite: 627]
    if(allFromUF || alts.some(a=>qn.includes(norm(a)))){ uf=k; break; } // [cite: 627]
  }
  if(uf){
    const aliasTokens = new Set([uf, ...UF_MAP[uf].flatMap(a=>tokenize(a))]); // [cite: 628]
    if(parts.every(t=>aliasTokens.has(t))) return {terms:new Set([uf]), uf}; // ex.: “espirito santo” [cite: 628]
  }

  // Lock por cidade se a frase aparece
  for(const [base,alts] of Object.entries(CITY_ALIASES)){ // [cite: 629]
    const all=[base,...alts.map(norm)]; // [cite: 629]
    if(all.some(a=>qn.includes(a))){ // [cite: 630]
      const tset = new Set([...tokenize(base), ...(uf?[uf]:[])]); // [cite: 630]
      return {terms:tset, uf, cityLock:base}; // [cite: 630]
    }
  }

  // Tokens especiais
  for(const [tok,rule] of Object.entries(SPECIAL_CITY_TOKENS)){ // [cite: 631]
    if(parts.includes(tok)){ // [cite: 631]
      const lockUF = uf || rule.uf; // [cite: 631]
      return {terms:new Set([tok, ...tokenize(rule.city), lockUF]), uf:lockUF, cityLock:rule.city}; // [cite: 632]
    }
  }

  // Expansão leve: se algum token for alias de cidade, adiciona base
  const extra=[]; // [cite: 632]
  for(const [base,alts] of Object.entries(CITY_ALIASES)){ // [cite: 633]
    const all = new Set([base,...alts.map(norm)]); // [cite: 633]
    for(const t of parts){ if(all.has(t)){ extra.push(base); break; } } // [cite: 633]
  }

  return {terms:new Set([...parts, ...extra, ...(uf?[uf]:[])]), uf}; // [cite: 634]
}

/* ========= Busca Refinada com Scoring (ATUALIZADO) ========= */
function search(index, q) {
  if (!index?.length) return []; // [cite: 635]
  const qn = norm(q || ""); if (!qn) return []; // [cite: 635]
  const { hasAffix, hasAlter } = detectBrands(qn); // [cite: 636]
  const { terms, uf, cityLock } = expandQuery(q); // Obtém termos normalizados, UF e cidade (se houver) [cite: 636]

  // Filtros básicos (marca, UF estrita, cidade específica)
  const brandFilter = hasAffix || hasAlter; // [cite: 636]
  const passBrand = it =>
    !brandFilter || // [cite: 637]
    (hasAffix && it.url.includes(BRAND_DOMAINS.affix)) || // Verifica se URL contém o domínio da marca [cite: 637]
    (hasAlter && it.url.includes(BRAND_DOMAINS.alter)); // Verifica se URL contém o domínio da marca [cite: 637]
  const passCity = it => !cityLock || containsPhrase(it.slug, cityLock); // Verifica se slug contém a frase da cidade [cite: 638]

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
      matchedTermsCount = terms.size; //
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
      score += it.dscore / 50; // Ajuste o divisor para controlar o peso da data [cite: 609-610]
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

/* ========= Carregamento CSV e Busca (Interface) ========= */
const AFFIX_CSV_URL = "data/affix/affix_pdfs_manifest.csv"; // [cite: 561]
let AFFIX_PDFS = []; // [cite: 561]
let AFFIX_INDEX = []; // Guarda o índice construído

async function loadAffixCSV(){
  if (AFFIX_INDEX.length) return; // Só carrega uma vez
  const badge = $('#affixCount'); //
  badge.textContent = 'Carregando lista de PDFs...'; //
  const res = await fetch(AFFIX_CSV_URL); // [cite: 562]
  if (!res.ok) {
      badge.textContent = `Erro ${res.status} ao carregar CSV`; //
      throw new Error(`HTTP error ${res.status}`); //
  }
  const text = await res.text(); // [cite: 562]
  AFFIX_PDFS = parseAffixCSV(text); // [cite: 562]
  AFFIX_INDEX = buildIndex(AFFIX_PDFS); // Constrói o índice [cite: 624]
  badge.textContent = `${AFFIX_INDEX.length} PDFs indexados.`; //
}

// Função para parsear CSV (simplificada, adaptada para 3 colunas)
function parseAffixCSV(text){
  const lines = text.trim().split(/\r?\n/); // [cite: 563]
  if (lines.length < 2) return []; // Precisa de cabeçalho + dados
  const out = []; // [cite: 563]
  // Assumindo cabeçalho: name,url,keywords
  for (let i=1; i<lines.length; i++){ // [cite: 564]
    const line = lines[i].trim(); // [cite: 564]
    if (!line) continue; // [cite: 564]

    // Lógica simples para separar por vírgula, tratando aspas se necessário (básico)
    const parts = [];
    let currentPart = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"' && (j === 0 || line[j - 1] !== '\\')) { // Trata aspas de forma simples
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            parts.push(currentPart.trim().replace(/^"|"$/g, '')); // Remove aspas das pontas
            currentPart = '';
        } else {
            currentPart += char;
        }
    }
    parts.push(currentPart.trim().replace(/^"|"$/g, '')); // Adiciona a última parte

    // Espera 3 colunas: name, url, keywords
    if (parts.length === 3) {
      const [name, url, keywords] = parts; // [cite: 566]
      if (name && url) { // [cite: 566]
          out.push({ name, url, keywords: keywords || '' }); // Adiciona keywords ou string vazia [cite: 566]
      }
    } else {
        console.warn(`Linha ${i+1} ignorada: formato CSV inesperado (esperado 3 colunas). Conteúdo: ${line}`); // Avisa sobre linhas mal formatadas
    }
  }
  return out; // [cite: 566]
}


function toggleAffixPrev(i){
  const el = document.getElementById("affix_prev_" + i); // [cite: 567]
  if (!el) return; // [cite: 567]
  el.style.display = (el.style.display === "none" || !el.style.display) ? "block" : "none"; // [cite: 567-568]
}

// Função googleViewerURL (AJUSTADA para limpar URL)
function googleViewerURL(fileUrl){
  // <<< AJUSTE AQUI >>>
  // Garante que a URL esteja limpa (sem espaços) e corretamente codificada para a web
  const cleaned = String(fileUrl || '').trim(); // Garante que é string e limpa espaços
  if (!cleaned || cleaned === '#') return ''; // Retorna vazio se não houver URL válida
  return "https://docs.google.com/viewer?embedded=true&url=" + encodeURIComponent(cleaned); // Codifica corretamente [cite: 568]
}


// Função searchAffixPDFs (AJUSTADA para usar window.search e limpar URLs)
async function searchAffixPDFs(q){
  const list   = $('#affixList'); // [cite: 568]
  const badge = $('#affixCount'); // [cite: 569]
  try {
    await loadAffixCSV(); // Garante que o índice esteja carregado [cite: 569]
  } catch(e){
    badge.textContent='Erro ao carregar lista de PDFs.'; // [cite: 569]
    list.textContent='Falha no carregamento: '+(e.message||e); // [cite: 569]
    return; // [cite: 569]
  }

  const term = (q||'').toLowerCase().trim(); // [cite: 570]

  // Usa a função search global (que agora tem scoring) passando o índice construído
  const results = window.search(AFFIX_INDEX, term); // Chama a função search principal com o índice [cite: 647-648]

  badge.textContent = `${results.length} resultado(s)`; // [cite: 572]
  if(!results.length){ list.textContent='—'; return; } // [cite: 572]

  list.innerHTML = ''; // [cite: 572]
  let i = 0; // [cite: 572]
  function pump(){ // [cite: 573]
    const frag = document.createDocumentFragment(); // [cite: 573]
    for(let k=0; k<10 && i<results.length; k++, i++){ // [cite: 573]
      const r = results[i]; // [cite: 573]
      const row = document.createElement('div'); // [cite: 574]
      row.className = 'affix-row'; // [cite: 574]

      // <<< AJUSTE PRINCIPAL AQUI (URL Limpa) >>>
      // Limpa a URL ANTES de usá-la e define um fallback seguro
      const cleanUrl = r.url ? String(r.url).trim() : '#';
      // Gera a URL do Google Viewer SÓ SE a URL for válida
      const viewerUrl = googleViewerURL(cleanUrl); // Chama googleViewerURL com a URL limpa

      // Cria o HTML para a linha do resultado
      row.innerHTML =
        `<div><b>${esc(r.name)}</b></div>
         <div class="affix-actions">
           <button class="btn btn-plain" onclick="window.open('${cleanUrl}','_blank')" ${cleanUrl === '#' ? 'disabled' : ''}>Abrir</button>
           <button class="btn btn-plain" onclick="toggleAffixPrev(${i})" ${cleanUrl === '#' ? 'disabled' : ''}>Prévia</button>
         </div>
         <div id="affix_prev_${i}" class="affix-prev">
           ${viewerUrl ? // Só mostra o iframe se viewerUrl foi gerada
             `<iframe
               src="${viewerUrl}"
               referrerpolicy="no-referrer"
               loading="lazy"></iframe>`
              : '<p style="padding: 20px; text-align: center; color: var(--muted);">Prévia indisponível.</p>' // Mensagem mais clara [cite: 575]
           }
         </div>`; // [cite: 574-576]
      // <<< FIM DO AJUSTE >>>

      frag.appendChild(row); // [cite: 576]
    }
    list.appendChild(frag); // [cite: 576]
    if(i < results.length) requestAnimationFrame(pump); // [cite: 576]
  }
  pump(); // [cite: 577]
}

/* ========= Outras Funções da Interface (Sites, CRION, Alerta, Feedback, Widgets) ========= */

// --- Funções do Google Apps Script (GAS) ---
const APP_URL = "https://script.google.com/macros/s/AKfycbzYHcP4jOPyTXuaWJiaLg1Gr5FP_G1mZNCwV33Se-PJ3wjFLjddwEN9fcRNJxBo2Df0ig/exec"; // [cite: 529]
const $ = s => document.querySelector(s); // [cite: 530]
const show = (el, on=true)=>{ if(!el) return; el.style.display = on ? '' : 'none'; }; // [cite: 530-531]
function esc(s){ return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); } // [cite: 531]
function cleanName(n){ return String(n||'').replace(/^(OCR_TMP_|TMP_SLIDES_)+/ig,''); } // [cite: 531]
function link(url, txt){ return `<a href="${url}" target="_blank" rel="noopener">${esc(txt||url)}</a>`; } // [cite: 531]
function humanSize(b){ if(!b||b<=0) return "—"; const u=["B","KB","MB","GB"]; let i=0; while(b>=1024&&i<u.length-1){ b/=1024; i++; } return b.toFixed(1)+" "+u[i]; } // [cite: 532]

function call(endpoint, payload){
  const url = APP_URL + "?fn=" + encodeURIComponent(endpoint); // [cite: 533]
  return fetch(url, { // [cite: 534]
    method:"POST", // [cite: 534]
    headers:{ "Content-Type":"text/plain" }, // [cite: 534]
    body: JSON.stringify(payload || {}) // [cite: 534]
  }).then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }); // [cite: 534]
}

// --- Widgets (Post-it / Calculadora) ---
function toggleNoteWrap(isCloseButton){
    const noteWrap = $('#noteWrap'); // [cite: 536]
    const noteArea = $('#noteArea'); // [cite: 536]
    const isVisible = noteWrap.style.display !== 'none'; // Verifica se está visível [cite: 536]
    if (isCloseButton || isVisible) { // Se for o botão fechar ou já estiver visível
        show(noteWrap, false); // Esconde [cite: 537]
    } else { // Se estiver escondido
        show(noteWrap, true); // Mostra [cite: 538]
        noteArea.focus(); // Foca na área de texto [cite: 538]
    }
}
function clearNote() {
    const noteArea = $('#noteArea'); // [cite: 539]
    noteArea.value=""; localStorage.removeItem('ric_note'); // [cite: 539]
}

function toggleCalcWrap(isCloseButton){
    const calcWrap = $('#calcWrap'); // [cite: 540]
    const isVisible = calcWrap.style.display !== 'none'; // Verifica se está visível [cite: 541]
    if (isCloseButton || isVisible) { // Se for o botão fechar ou já estiver visível
        show(calcWrap, false); // Esconde [cite: 541]
    } else { // Se estiver escondido
        show(calcWrap, true); // Mostra [cite: 542]
        refresh(); // Atualiza display da calculadora [cite: 542]
    }
}

const calc = { buf:"0", op:null, mem:0, fresh:true }; // [cite: 543]
function refresh(){ $('#scr').textContent = calc.buf; } // [cite: 543]
function press(k){
  if(/\d/.test(k)){ calc.buf = (calc.fresh||calc.buf==="0")? k : calc.buf+k; calc.fresh=false; return refresh(); } // [cite: 544]
  if(k==="00"){ press("0"); press("0"); return; } // [cite: 544]
  if(k==="."){ if(!calc.buf.includes(".")) calc.buf += "."; calc.fresh=false; return refresh(); } // [cite: 545]
  if(k==="C"){ calc.buf="0"; calc.op=null; calc.fresh=true; return refresh(); } // [cite: 545]
  if(k==="±"){ if(calc.buf!=="0") calc.buf = calc.buf.startsWith("-")? calc.buf.slice(1):"-"+calc.buf; return refresh(); } // [cite: 546]
  if(k==="%"){ calc.buf = String(parseFloat(calc.buf)/100); return refresh(); } // [cite: 546]
  if("+-*/".includes(k)){ calc.mem=parseFloat(calc.buf); calc.op=k; calc.fresh=true; return; } // [cite: 547]
  if(k==="=" && calc.op){
    const a=calc.mem, b=parseFloat(calc.buf); // [cite: 547]
    let v=0; // [cite: 547]
    switch(calc.op){case "+":v=a+b;break;case "-":v=a-b;break;case "*":v=a*b;break;case "/":v=b===0? "Erro" : a/b;break;} // [cite: 548]
    calc.buf=String(v); calc.op=null; calc.fresh=true; return refresh(); // [cite: 548]
  }
}

// --- Feedback ---
async function doFeedback(){
  const qFeedback = $('#qFeedback'); // [cite: 549]
  const feedbackStatus = $('#feedbackStatus'); // [cite: 550]
  const feedbackBusy = $('#feedbackBusy'); // [cite: 550]

  const q = (qFeedback.value||'').trim(); // [cite: 550]
  const placeholderText = qFeedback.placeholder; // [cite: 550]
  if(!q || q === placeholderText){ // [cite: 551]
    feedbackStatus.textContent='Por favor, digite sua mensagem.'; // [cite: 551]
    return; // [cite: 551]
  }

  show(feedbackBusy,true); // [cite: 551]
  feedbackStatus.textContent='Enviando...'; // [cite: 551]
  try{
    const r = await call('savefeedback',{mensagem: q}); // [cite: 552]
    if(!r || r.ok===false){ // [cite: 553]
      feedbackStatus.textContent=' Erro ao enviar: '+(r&&r.message?r.message:''); // [cite: 553]
    } else {
      feedbackStatus.textContent=' Feedback enviado com sucesso! Obrigado!'; // [cite: 554]
      qFeedback.value = ''; // [cite: 554]
    }
  }catch(e){
    feedbackStatus.textContent=' Erro na comunicação: '+(e.message||e); // [cite: 555]
  }finally{
    show(feedbackBusy,false); // [cite: 555]
  }
}

// --- Alerta ---
async function doAlerts(){
  const msg=$('#alertMsg'), resp=$('#alertResp'); // [cite: 556]
  const alertBusy = $('#alertBusy'); // [cite: 556]
  show(msg,false); show(resp,false); show(alertBusy,true); // [cite: 557]

  try{
    const r = await call('getalert',{}); // [cite: 557]
    if(!r || r.ok===false){ msg.textContent="Falha ao consultar."; show(msg,true); return; } // [cite: 557]
    if(!r.found){ msg.textContent="Sem recado no momento."; show(msg,true); return; } // [cite: 558]
    msg.textContent = " " + String(r.mensagem||"—").toUpperCase(); show(msg,true); // [cite: 559]
    if(r.responsavel){ resp.textContent = String(r.responsavel||"").toLowerCase(); show(resp,true); } // [cite: 559]
  }catch(e){ msg.textContent="Erro: "+(e.message||e); show(msg,true); // [cite: 560]
  }finally{
    show(alertBusy,false); // [cite: 560]
  }
}

// --- Busca nos Sites (OpenAI) ---
async function doSites(){
  const q=($('#qSites').value||'').trim(); // [cite: 576]
  const sitesBusy = $('#sitesBusy'); // [cite: 577]
  const outSites = $('#outSites'); // [cite: 577]

  // Chama a busca local de PDFs primeiro
  searchAffixPDFs(q); // [cite: 577]

  if(!q){ outSites.textContent='Digite a pergunta.'; return; } // [cite: 577]
  show(sitesBusy,true); outSites.textContent='—'; // [cite: 577]
  try{
    // Adiciona instrução de formatação e fonte ao prompt
    const qRich = q + " — FORMATO: responda em português com texto útil e liste as URLs oficiais no final. Substitua observações por: 'Fontes oficiais Affix, Alter, Hapvida'."; // [cite: 578]
    const r = await call('chat',{q:qRich}); // Chama a API do GAS [cite: 579]
    const txt = (r && r.text) ? r.text : '—'; // [cite: 579]
    // Transforma URLs em links clicáveis no HTML
    const html = String(txt).replace(/(https?:\/\/[^\s<]+)/g, m=>`<a href="${m}" target="_blank" rel="noopener">${m}</a>`); // [cite: 580]
    outSites.innerHTML = html; // [cite: 580]
  }catch(e){ outSites.textContent='Erro: '+(e.message||e); // [cite: 580]
  }finally{ show(sitesBusy,false); // [cite: 580]
  }
}

// --- Busca CRION (Procedimentos Indexados no GAS) ---
async function doCRION(){
  const q=($('#qCRION').value||'').trim(); // [cite: 581]
  const crionStatus = $('#crionStatus'); // [cite: 581]
  const crionList = $('#crionList'); // [cite: 582]
  const crionBusy = $('#crionBusy'); // [cite: 582]

  if(!q){ crionStatus.textContent='Digite um termo.'; return; } // [cite: 582]
  show(crionBusy,true); crionStatus.textContent='Listando arquivos…'; crionList.innerHTML=""; // [cite: 582]
  try{
    const res = await call('searchcrion',{q}); // Chama API do GAS para buscar [cite: 583]
    if(!res || res.ok===false){ crionStatus.textContent='Erro ao buscar: '+(res&&res.message?res.message:''); return; } // [cite: 583]
    const items=res.items||[]; crionStatus.textContent=`Resultados: ${items.length}`; // [cite: 584]
    const frag=document.createDocumentFragment(); // [cite: 584]
    items.forEach((it,idx)=>{ // [cite: 585]
      const li=document.createElement('li'); li.style.padding="10px 0"; li.style.borderTop="1px solid var(--line)"; li.id='crion_'+idx; // [cite: 585]
      const meta   = `<div class="hint">Tamanho: ${humanSize(it.size||0)} • Atualizado: ${it.updated? new Date(it.updated).toLocaleString(): "—"}</div>`; // [cite: 585]
      li.innerHTML=`<div><b>${esc(cleanName(it.name))}</b> • ${link(it.url,'Abrir')}</div>${meta}
                   <div class="hint" id="snip_crion_${idx}">Carregando prévias…</div>`; // [cite: 585]
      frag.appendChild(li); // [cite: 585]
    });
    crionList.appendChild(frag); // [cite: 586]
    if(items.length){
      let from=0; // [cite: 586]
      while(from < items.length){
        const r = await call('fetchcrionsnippets',{sessionId:res.sessionId, from, limit:6}); // Busca snippets [cite: 586]
        (r.items||[]).forEach(row=>{ // [cite: 587]
          const el=$('#snip_crion_'+row.index); // [cite: 587]
          el.innerHTML=(row.snippets && row.snippets.length)? row.snippets.map(s=>`<div style="color:#374151;margin:6px 0">${esc(s)}</div>`).join("") : '<span class="hint">—</span>'; // [cite: 587]
        });
        from = r.to; // [cite: 588]
      }
      crionStatus.textContent += " • prévias completas"; // [cite: 588]
    }
  }catch(e){ crionStatus.textContent='Erro: '+(e.message||e); // [cite: 588]
  }finally{ show(crionBusy,false); } // [cite: 589]
}

// --- Inicialização e Event Listeners ---
window.onload = function() { // [cite: 589]

    // Configuração dos botões principais
    $('#btnAlert').addEventListener('click', doAlerts); // [cite: 589]
    $('#btnSites').addEventListener('click', doSites); // [cite: 590]
    $('#btnCRION').addEventListener('click', doCRION); // [cite: 590]
    $('#btnFeedback').addEventListener('click', doFeedback); // [cite: 590]

    // Configuração dos Widgets (Post-it / Calculadora)
    $('#toggleNote').addEventListener('click', () => toggleNoteWrap(false)); // [cite: 590]
    $('#closeNote').addEventListener('click', () => toggleNoteWrap(true)); // Passa true para indicar que é o botão fechar [cite: 591]
    $('#clearNote').addEventListener('click', clearNote); // [cite: 591]

    $('#toggleCalc').addEventListener('click', () => toggleCalcWrap(false)); // [cite: 591]
    $('#closeCalc').addEventListener('click', () => toggleCalcWrap(true)); // Passa true para indicar que é o botão fechar [cite: 591]

    // Calculadora Key Presses
    const keys = $('#keys'); // [cite: 592]
    if (keys) { // [cite: 593]
        keys.addEventListener('click', e => { // [cite: 593]
            const k = e.target.dataset.k; // [cite: 593]
            if(k) press(k); // [cite: 593]
        });
    }

    // Post-it Persistence
    const noteArea = $('#noteArea'); // [cite: 594]
    if (noteArea) { // [cite: 595]
        noteArea.value = localStorage.getItem('ric_note') || ""; // [cite: 595]
        noteArea.addEventListener('input', ()=> localStorage.setItem('ric_note', noteArea.value)); // [cite: 595]
    }

    // Melhorias de UX (Enter nas buscas)
    const qSites = $('#qSites'); // [cite: 596]
    const btnSites = $('#btnSites'); // [cite: 597]
    if(qSites && btnSites) qSites.addEventListener('keydown', e=>{ if(e.key==='Enter') btnSites.click(); }); // [cite: 597]

    const qCRION = $('#qCRION'); // [cite: 597]
    const btnCRION = $('#btnCRION'); // [cite: 597]
    if(qCRION && btnCRION) qCRION.addEventListener('keydown', e=>{ if(e.key==='Enter') btnCRION.click(); }); // [cite: 598]

    // Carrega a lista de PDFs ao iniciar (para agilizar a primeira busca)
    loadAffixCSV().catch(err => {
      console.error("Falha inicial ao carregar CSV:", err); //
      $('#affixCount').textContent = 'Erro ao carregar lista.'; //
    });
};

/* ========= Export (browser global) ========= */
window.buildIndex = buildIndex; // [cite: 647]
window.search     = search; // [cite: 647]
