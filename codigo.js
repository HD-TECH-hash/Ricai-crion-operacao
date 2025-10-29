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
  "samp": { city:"sao bernardo", uf:"es" }
};
/* ========= Normalização (remove acento, til, cedilha etc.) ========= */
const STOP = new Set(["de","da","do","das","dos","e","a","o","as","os","the"]); [cite_start]// [cite: 339]
const norm = s => String(s||"")
  .toLowerCase()
  [cite_start].normalize("NFD")                 // separa acentos [cite: 340]
  [cite_start].replace(/\p{Diacritic}/gu,"")    // remove acentos (ã→a, ç→c) [cite: 340]
  [cite_start].replace(/[._]/g," ") // [cite: 340]
  [cite_start].replace(/\s+/g," ") // [cite: 340]
  .trim(); [cite_start]// [cite: 340]
const tokenize = s => norm(s)
  [cite_start].replace(/[-/]/g," ")             // hífen/barra viram espaço [cite: 341]
  [cite_start].replace(/[^\p{Letter}\p{Number}\s]/gu," ") // [cite: 341]
  [cite_start].split(/\s+/) // [cite: 341]
  .filter(t=>t && !STOP.has(t)); [cite_start]// [cite: 341]
/* ========= Marcas/domínios ========= */
const BRAND_DOMAINS = { affix:"affix.com.br", alter:"alter.com.br" }; [cite_start]// [cite: 342]
const detectBrands = qn => ({ hasAffix:/\baffix\b/i.test(qn), hasAlter:/\balter\b/i.test(qn) }); [cite_start]// [cite: 342]
/* ========= Data no nome → boost ========= */
function extractMY(nameN){
  const m = nameN.match(/[-_](0[1-9]|1[0-2])[-_](\d{2})(?=($|[^0-9]))/); [cite_start]// [cite: 343]
  return m ? {year:2000+ +m[2], month:+m[1]} : null; [cite_start]// [cite: 344]
}
const dateScore = item => { const my=extractMY(item.nameN); return my? my.year*12+my.month : 0; }; [cite_start]// [cite: 344]
/* ========= Helpers de match ========= */
const wordsSlug   = s => ` ${tokenize(s).join(" ")} `; [cite_start]// [cite: 345]
const containsWord   = (slug,t)=> slug.includes(` ${t} `); [cite_start]// [cite: 346]
const containsPhrase = (slug,phrase)=>{
  const p = tokenize(phrase).join(" "); [cite_start]// [cite: 346]
  return p && slug.includes(` ${p} `); [cite_start]// [cite: 347]
};

/* UF forte: sigla isolada por não-letras (ex.: “-ES-”, “(ES)”) */
function hasUFStrong(raw, uf){
  const sig = uf.toUpperCase(); [cite_start]// [cite: 347]
  const re = new RegExp(`(^|[^A-Za-z])${sig}([^A-Za-z]|$)`); [cite_start]// [cite: 348]
  return re.test(raw); [cite_start]// [cite: 348]
}
/* Regra extra: “ES-Manual” ou “Manual-ES” força ES */
function hasESManual(raw){
  return /(^|[^A-Za-z])ES([^A-Za-z].*manual|$)|manual[^A-Za-z].*ES([^A-Za-z]|$)/i.test(raw); [cite_start]// [cite: 348]
}
function passUFStrict(it, uf){
  if(!uf) return true; [cite_start]// [cite: 349]
  if(it.ufs.has(uf)) return true; [cite_start]// [cite: 349]
  if(uf==="es" && (hasESManual(it.nameRaw)||hasESManual(it.urlRaw))) return true; [cite_start]// [cite: 349]
  return hasUFStrong(it.nameRaw, uf) || hasUFStrong(it.urlRaw, uf); [cite_start]// [cite: 349-350]
}

/* ========= Indexação com Keywords do CSV (ATUALIZADO) ========= */
function buildIndex(rows){
  const seen=new Set(), out=[]; [cite_start]// [cite: 350]
  for(const r of rows){
    // Verifica se a linha tem as 3 colunas esperadas (name, url, keywords)
    if(!r || !r.name || !r.url || typeof r.keywords === 'undefined') continue; // Pula linha mal formatada

    let url=String(r.url).trim(); [cite_start]// [cite: 351]
    if(/^http:\/\//i.test(url)) url=url.replace(/^http:\/\//i,"https://"); [cite_start]// força https [cite: 351]
    if(!/^https?:\/\/[^\s]+$/i.test(url)) continue; [cite_start]// Valida URL [cite: 352]
    if(seen.has(url)) continue; seen.add(url); [cite_start]// Evita duplicatas pela URL [cite: 352]

    const nameRaw = String(r.name); [cite_start]// [cite: 352]
    const urlRaw  = url; [cite_start]// [cite: 352]
    const keywordsRaw = String(r.keywords || ''); // Pega a string de keywords

    const nameN = norm(nameRaw); [cite_start]// [cite: 353]
    const urlN  = norm(urlRaw); [cite_start]// [cite: 353]
    const keywordsN = norm(keywordsRaw); // Normaliza as keywords também

    // O slug agora inclui palavras do nome, URL e keywords
    const slug  = wordsSlug(nameRaw + " " + urlRaw + " " + keywordsRaw); [cite_start]// Adiciona keywords ao slug [cite: 353]

    // O conjunto kws agora inclui tokens do nome, URL e keywords
    const kws   = new Set([
      [cite_start]...tokenize(nameRaw), // [cite: 354]
      [cite_start]...tokenize(urlRaw), // [cite: 354]
      ...tokenize(keywordsRaw) // Adiciona tokens das keywords
    ]);

    // --- O restante da lógica de detecção de UFs e Cidades permanece igual ---
    const ufs=new Set(); [cite_start]// [cite: 354]
    [cite_start]for(const [uf,alts] of Object.entries(UF_MAP)){ // [cite: 355]
      const altsN=[uf, ...alts.map(norm)]; [cite_start]// [cite: 355]
      // Verifica se algum alias da UF está no slug (que agora inclui keywords)
      if(altsN.some(a=>containsWord(slug,a))) ufs.add(uf); [cite_start]// [cite: 355]
      // Mantém a verificação forte na URL e Nome originais
      else if(hasUFStrong(nameRaw,uf) || hasUFStrong(urlRaw,uf)) ufs.add(uf); [cite_start]// [cite: 355]
    }
    if(hasESManual(nameRaw) || hasESManual(urlRaw)) ufs.add("es"); [cite_start]// Reforço ES-Manual [cite: 356]

    const cities=new Set(); [cite_start]// [cite: 356]
    [cite_start]for(const [base,alts] of Object.entries(CITY_ALIASES)){ // [cite: 357]
      const all=[base, ...alts.map(norm)]; [cite_start]// [cite: 357]
      // Verifica se algum alias da cidade está no slug (que agora inclui keywords)
      if(all.some(a=>containsPhrase(slug,a))) cities.add(base); [cite_start]// [cite: 357]
    }
    // --------------------------------------------------------------------

    // Adiciona o campo 'tags' (versão normalizada das keywords) ao objeto do índice
    out.push({
      [cite_start]name:r.name, // [cite: 358]
      [cite_start]url:urlRaw, // [cite: 358]
      [cite_start]nameN, // [cite: 358]
      [cite_start]urlN, // [cite: 358]
      [cite_start]slug, // [cite: 358]
      [cite_start]kws, // [cite: 358]
      [cite_start]ufs, // [cite: 358]
      [cite_start]cities, // [cite: 358]
      tags: new Set(tokenize(keywordsRaw)), // Guarda os tokens das keywords separadamente
      [cite_start]dscore:dateScore({nameN}), // [cite: 358]
      [cite_start]nameRaw, // [cite: 358]
      [cite_start]urlRaw // [cite: 358]
    });
  }
  return out; [cite_start]// [cite: 359]
}


/* ========= Expansão de consulta (UF/cidade/aliases/tokens) ========= */
function expandQuery(q){
  const qn    = norm(q); [cite_start]// [cite: 359]
  const parts = tokenize(qn); [cite_start]// [cite: 360]

  // Detecta UF e considera “apenas UF” se todos tokens são aliases dessa UF
  let uf=null; [cite_start]// [cite: 360]
  [cite_start]for(const [k,alts] of Object.entries(UF_MAP)){ // [cite: 361]
    const aliasTokens = new Set([k, ...alts.flatMap(a=>tokenize(a))]); [cite_start]// [cite: 361]
    const allFromUF   = parts.length>0 && parts.every(t=>aliasTokens.has(t)); [cite_start]// [cite: 362]
    if(allFromUF || alts.some(a=>qn.includes(norm(a)))){ uf=k; break; [cite_start]} // [cite: 362]
  }
  if(uf){
    const aliasTokens = new Set([uf, ...UF_MAP[uf].flatMap(a=>tokenize(a))]); [cite_start]// [cite: 363]
    if(parts.every(t=>aliasTokens.has(t))) return {terms:new Set([uf]), uf}; [cite_start]// ex.: “espirito santo” [cite: 363]
  }

  // Lock por cidade se a frase aparece
  [cite_start]for(const [base,alts] of Object.entries(CITY_ALIASES)){ // [cite: 364]
    const all=[base,...alts.map(norm)]; [cite_start]// [cite: 364]
    [cite_start]if(all.some(a=>qn.includes(a))){ // [cite: 365]
      const tset = new Set([...tokenize(base), ...(uf?[uf]:[])]); [cite_start]// [cite: 365]
      return {terms:tset, uf, cityLock:base}; [cite_start]// [cite: 365]
    }
  }

  // Tokens especiais
  [cite_start]for(const [tok,rule] of Object.entries(SPECIAL_CITY_TOKENS)){ // [cite: 366]
    [cite_start]if(parts.includes(tok)){ // [cite: 366]
      const lockUF = uf || rule.uf; [cite_start]// [cite: 366]
      return {terms:new Set([tok, ...tokenize(rule.city), lockUF]), uf:lockUF, cityLock:rule.city}; [cite_start]// [cite: 367]
    }
  }

  // Expansão leve: se algum token for alias de cidade, adiciona base
  const extra=[]; [cite_start]// [cite: 367]
  [cite_start]for(const [base,alts] of Object.entries(CITY_ALIASES)){ // [cite: 368]
    const all = new Set([base,...alts.map(norm)]); [cite_start]// [cite: 368]
    for(const t of parts){ if(all.has(t)){ extra.push(base); break; [cite_start]} } // [cite: 368]
  }

  return {terms:new Set([...parts, ...extra, ...(uf?[uf]:[])]), uf}; [cite_start]// [cite: 369]
}

/* ========= Busca Refinada com Scoring (ATUALIZADO) ========= */
function search(index, q) {
  if (!index?.length) return []; [cite_start]// [cite: 370]
  const qn = norm(q || ""); if (!qn) return []; [cite_start]// [cite: 370]
  const { hasAffix, hasAlter } = detectBrands(qn); [cite_start]// [cite: 371]
  const { terms, uf, cityLock } = expandQuery(q); [cite_start]// Obtém termos normalizados, UF e cidade (se houver) [cite: 371]

  // Filtros básicos (marca, UF estrita, cidade específica)
  const brandFilter = hasAffix || hasAlter; [cite_start]// [cite: 371]
  const passBrand = it =>
    !brandFilter || [cite_start]// [cite: 372]
    (hasAffix && it.url.includes(BRAND_DOMAINS.affix)) || [cite_start]// Verifica se URL contém o domínio da marca [cite: 372]
    (hasAlter && it.url.includes(BRAND_DOMAINS.alter)); [cite_start]// Verifica se URL contém o domínio da marca [cite: 372]
  const passCity = it => !cityLock || containsPhrase(it.slug, cityLock); [cite_start]// Verifica se slug contém a frase da cidade [cite: 373]

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
    const exactMatch = it.nameN.includes(qn) || it.urlN.includes(qn); [cite_start]// Verifica se nome ou URL normalizado contém a query exata [cite: 375]
    if (exactMatch) {
      score = 10000; [cite_start]// Pontuação muito alta para match exato [cite: 375]
      matchedTermsCount = terms.size; [cite_start]// [cite: 375]
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


/* ========= Export (browser global) ========= */
window.buildIndex = buildIndex; [cite_start]// [cite: 382]
window.search     = search; [cite_start]// [cite: 382]
