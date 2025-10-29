// codigo.js — CRION busca de alta precisão (index local, mínima alucinação) - VERSÃO ORIGINAL + CORREÇÃO URL + ASSOCIAÇÃO UF/CIDADE + DEBUG

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
  "sao cristovao":["são cristovao","sao cristovão","são cristovão","s.cristovao","s cristovao","sao-cristovao","s cristovão","s.cristovão"], // SE? Adicionar mapeamento se souber
  "sao bernardo":["são bernardo","s bernardo","s.bernardo","sao-bernardo","sao bernado","samp"], // SP / ES (samp)
  "sao jose dos campos":[ "sjc","s jose dos campos","s.jose dos campos","são josé dos campos" ], // SP
  "belo horizonte":[ "bh" ], // MG
  "rio de janeiro":[ "rj capital","rio" ], // RJ
  "sao paulo":[ "são paulo","sp capital","sampa" ], // SP
  "porto alegre":[ "poa" ], // RS
  "cuiaba":[ "cuiabá" ], // MT
  "goiania":[ "goiânia" ], // GO
  "joao pessoa":[ "joão pessoa" ], // PB
  "tres lagoas":[ "três lagoas" ], // MS
  "mossoro":[ "mossoró" ], // RN
  "uberlandia":[ "uberlândia" ], // MG
  "ribeirao preto":[ "ribeirão preto" ], // SP
  "vitoria de santo antao":[ "vitória de santo antão" ], // PE
  "ananindeua": ["ananindeua"], // PA
  "marituba": ["marituba"], // PA
  "manaus": ["manaus"], // AM
  "imperatriz": ["imperatriz"], // MA
  "sao luis": ["são luis", "sao luís", "são luís"], // MA
  "teresina": ["teresina"], // PI
  "fortaleza": ["fortaleza"], // CE
  "juazeiro do norte": ["juazeiro do norte"], // CE
  "aquiraz": ["aquiraz"], // CE
  "beberibe": ["beberibe"], // CE
  "caucaia": ["caucaia"], // CE
  "chorozinho": ["chorozinho"], // CE
  "itaitinga": ["itaitinga"], // CE
  "maracanau": ["maracanaú"], // CE
  "pacajus": ["pacajus"], // CE
  "pacatuba": ["pacatuba"], // CE
  "paracuru": ["paracuru"], // CE
  "redencao": ["redenção"], // CE
  "natal": ["natal"], // RN
  "barauna": ["baraúna"], // RN
  "macaiba": ["macaíba"], // RN
  "campina grande": ["campina grande"], // PB
  "cabedelo": ["cabedelo"], // PB
  "conde": ["conde"], // PB (Assume PB, verificar se existe em outro estado)
  "santa rita": ["santa rita"], // PB (Assume PB, verificar se existe em outro estado)
  "recife": ["recife"], // PE
  "abreu e lima": ["abreu e lima"], // PE
  "aracoiaba": ["araçoiaba"], // PE (Assume PE)
  "igarassu": ["igarassu"], // PE
  "ipojuca": ["ipojuca"], // PE
  "itamaraca": ["itamaracá"], // PE
  "olinda": ["olinda"], // PE
  "paulista": ["paulista"], // PE (Assume PE)
  "pombos": ["pombos"], // PE
  "jaboatao dos guararapes": ["jaboatão dos guararapes"], // PE
  "sao lourenco da mata": ["são lourenço da mata"], // PE
  "maceio": ["maceió"], // AL
  "messias": ["messias"], // AL / BA (Precisa de desambiguação no nome do arquivo ou keywords se usar)
  "rio largo": ["rio largo"], // AL
  "camacari": ["camaçari"], // BA
  "feira de santana": ["feira de santana"], // BA
  "salvador": ["salvador"], // BA
  "pocoes": ["poções"], // BA
  "dias d avila": ["dias d'avila", "dias d avila"], // BA
  "simoes filho": ["simões filho"], // BA
  "aiquara": ["aiquara"], // BA
  "jitauna": ["jitaúna"], // BA
  "macarani": ["macarani"], // BA
  "tremedal": ["tremedal"], // BA
  "vitoria da conquista": ["vitória da conquista"], // BA
  "aracaju": ["aracaju"], // SE
  "barra dos coqueiros": ["barra dos coqueiros"], // SE
  "anapolis": ["anápolis"], // GO
  "uberaba": ["uberaba"], // MG
  "jundiai": ["jundiaí"], // SP
  "campo limpo paulista": ["campo limpo paulista", "campo limpo"], // SP
  "curitiba": ["curitiba"], // PR
  "londrina": ["londrina"], // PR
  "maringa": ["maringá"], // PR
  "balneario camboriu": ["balneário camboriú"], // SC
  "joinville": ["joinville"], // SC
  "araraquara": ["araraquara"], // SP
  "bauru": ["bauru"], // SP
  "franca": ["franca"], // SP
  "limeira": ["limeira"], // SP
  "lins": ["lins"], // SP
  "sertaozinho": ["sertãozinho"], // SP
  "campo grande": ["campo grande"], // MS
  "dourados": ["dourados"] // MS
};

/* ========= NOVO: Mapeamento Cidade -> UF ========= */
const CITY_TO_UF_MAP = {
  "manaus": "am",
  "belem": "pa", "parauapebas": "pa", "ananindeua": "pa", "marituba": "pa",
  "sao luis": "ma", "imperatriz": "ma",
  "teresina": "pi",
  "fortaleza": "ce", "juazeiro do norte": "ce", "aquiraz": "ce", "beberibe": "ce", "caucaia": "ce", "chorozinho": "ce", "itaitinga": "ce", "maracanau": "ce", "pacajus": "ce", "pacatuba": "ce", "paracuru": "ce", "redencao": "ce",
  "natal": "rn", "mossoro": "rn", "barauna": "rn", "macaiba": "rn",
  "campina grande": "pb", "joao pessoa": "pb", "cabedelo": "pb", "conde": "pb", "santa rita": "pb",
  "recife": "pe", "abreu e lima": "pe", "aracoiaba": "pe", "igarassu": "pe", "ipojuca": "pe", "itamaraca": "pe", "olinda": "pe", "paulista": "pe", "pombos": "pe", "jaboatao dos guararapes": "pe", "sao lourenco da mata": "pe", "vitoria de santo antao": "pe",
  "maceio": "al", "rio largo": "al",
  "camacari": "ba", "feira de santana": "ba", "salvador": "ba", "pocoes": "ba", "dias d avila": "ba", "simoes filho": "ba", "aiquara": "ba", "jitauna": "ba", "macarani": "ba", "tremedal": "ba", "vitoria da conquista": "ba",
  // Messias aparece em AL e BA nos arquivos, difícil mapear sem contexto extra
  "aracaju": "se", "barra dos coqueiros": "se",
  "brasilia": "df",
  "anapolis": "go", "goiania": "go",
  "belo horizonte": "mg", "uberaba": "mg", "uberlandia": "mg", // Cidades de MG mapeadas para 'mg'
  "sao bernardo": "sp", // Considerando SP como padrão para S. Bernardo, 'samp' trata ES
  "sao jose dos campos": "sp", "sao paulo": "sp", "ribeirao preto": "sp", "jundiai": "sp", "campo limpo paulista": "sp", "araraquara": "sp", "bauru": "sp", "franca": "sp", "limeira": "sp", "lins": "sp", "sertaozinho": "sp",
  "curitiba": "pr", "londrina": "pr", "maringa": "pr",
  "porto alegre": "rs",
  "balneario camboriu": "sc", "joinville": "sc",
  "campo grande": "ms", "dourados": "ms", "tres lagoas": "ms",
  "cuiaba": "mt", "rondonopolis": "mt"
  // Adicionar outras cidades importantes se necessário
};

/* ========= Token especial que “força” UF/cidade ========= */
const SPECIAL_CITY_TOKENS = {
  // “samp” no nome/consulta indica linha São Bernardo no ES E força UF ES
  "samp": { city:"sao bernardo", uf:"es", forceUF: true }
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
// Função passUFStrict (Verifica se o item pertence à UF)
function passUFStrict(it, uf){
  if(!uf) return true; // Se não buscou por UF, passa
  // Verifica se o índice (agora enriquecido por buildIndex) contém a UF
  if(it.ufs.has(uf)) return true;
  // Regras específicas (ex: ES-Manual) ainda podem ser úteis como fallback
  if(uf==="es" && (hasESManual(it.nameRaw)||hasESManual(it.urlRaw))) return true;
  // Verifica sigla forte no nome ou URL como fallback final (Reativado por segurança)
  if (hasUFStrong(it.nameRaw, uf) || hasUFStrong(it.urlRaw, uf)) return true;
  return false; // Se não está no set ufs (enriquecido) E não tem sigla forte, não passa
}

/* ========= Indexação (Original + Associação Cidade->UF + DEBUG) ========= */
function buildIndex(rows){
  const seen=new Set(), out=[];
  console.log("[DEBUG buildIndex] Iniciando indexação..."); // Log inicial
  for(const r of rows){
    // Espera apenas name e url
    if(!r || !r.name || !r.url) continue;

    let url=String(r.url).trim();
    if(/^http:\/\//i.test(url)) url=url.replace(/^http:\/\//i,"https://"); // força https
    if(!/^https?:\/\/[^\s]+$/i.test(url)) continue;
    if(seen.has(url)) continue; seen.add(url);

    const nameRaw = String(r.name);
    const urlRaw  = url;

    const nameN = norm(nameRaw);
    const urlN  = norm(urlRaw);
    // Slug e Kws baseados apenas em name e url
    const slug  = wordsSlug(nameRaw+" "+urlRaw);
    const kws   = new Set(tokenize(nameRaw).concat(tokenize(urlRaw)));

    // --- Lógica de UFs e Cidades (Refinada com Debug) ---
    const ufs=new Set();
    // 1. Detecta UFs diretamente (nome, URL, sigla forte)
    for(const [uf_key,alts] of Object.entries(UF_MAP)){
      const altsN=[uf_key, ...alts.map(norm)];
      if(altsN.some(a=>containsWord(slug,a))) ufs.add(uf_key);
      else if(hasUFStrong(nameRaw,uf_key) || hasUFStrong(urlRaw,uf_key)) ufs.add(uf_key);
    }
    if(hasESManual(nameRaw) || hasESManual(urlRaw)) ufs.add("es"); // reforço ES-Manual

    // 2. Detecta Cidades e associa UF
    const cities=new Set();
    for(const [base,alts] of Object.entries(CITY_ALIASES)){
      const all=[base, ...alts.map(norm)];
      // Usa containsPhrase para checar se a cidade (ou alias) está no slug
      if(all.some(a=>containsPhrase(slug,a))) {
          cities.add(base); // Adiciona a cidade base encontrada
          // <<< NOVO: Associa cidade à UF >>>
          const ufForCity = CITY_TO_UF_MAP[base]; // Busca UF no novo mapa
          if (ufForCity) {
              // <<< DEBUG LOG ADICIONADO >>>
              const added = ufs.has(ufForCity); // Verifica se já tinha
              ufs.add(ufForCity); // Adiciona a UF correspondente
              // Loga APENAS se adicionou algo novo E for uma cidade de MG
              if (!added && ['belo horizonte', 'uberlandia', 'uberaba'].includes(base)) {
                 console.log(`[DEBUG buildIndex] Associou UF '${ufForCity}' pela cidade '${base}' no arquivo: ${nameRaw}`);
              }
              // <<< FIM DO DEBUG LOG >>>
          }
      }
    }
    // Adiciona um log extra para ver o conjunto final de UFs para arquivos de MG
    if (cities.has('belo horizonte') || cities.has('uberlandia') || cities.has('uberaba') || nameN.includes(' minas gerais ') || nameN.includes(' mg ')) {
         console.log(`[DEBUG buildIndex] UFs FINAIS para ${nameRaw}:`, Array.from(ufs).join(', ') || 'Nenhuma');
    }
    // ------------------------------------

    out.push({ name:r.name, url:urlRaw, nameN, urlN, slug, kws, ufs, cities, dscore:dateScore({nameN}), nameRaw, urlRaw });
  }
  console.log(`[DEBUG buildIndex] Indexação concluída. ${out.length} itens indexados.`); // Log final
  return out;
}


/* ========= Expansão de consulta (UF/cidade/aliases/tokens - Refinada) ========= */
function expandQuery(q){
  const qn    = norm(q);
  const parts = tokenize(qn);
  let queryIsOnlyUF = false;
  let queryIsOnlyCity = false;
  let foundCity = null;

  // Detecta UF
  let uf=null;
  for(const [k,alts] of Object.entries(UF_MAP)){
    const aliasTokens = new Set([k, ...alts.flatMap(a=>tokenize(a))]);
    const allFromUF   = parts.length>0 && parts.every(t=>aliasTokens.has(t));
    const hasExactSigla = parts.includes(k) && aliasTokens.has(k);
     if( hasExactSigla || allFromUF || alts.some(a=>qn.includes(norm(a)))){
       uf=k;
       if (allFromUF) queryIsOnlyUF = true; // Marca se a query SÓ tem termos da UF
       break;
    }
  }

  // Lock por cidade se a frase aparece
  let cityLock = null;
  for(const [base,alts] of Object.entries(CITY_ALIASES)){
    const all=[base,...alts.map(norm)];
    if(all.some(a=>qn.includes(a))){
       cityLock = base;
       foundCity = base;
       // Verifica se a busca foi SÓ pela cidade
       const cityTokensAll = new Set(all.flatMap(a => tokenize(a)));
       if (parts.every(p => cityTokensAll.has(p))) {
           queryIsOnlyCity = true;
       }
       break; // Pega a primeira cidade encontrada
    }
  }

  // Tokens especiais (ex: samp -> ES)
  for(const [tok,rule] of Object.entries(SPECIAL_CITY_TOKENS)){
    if(parts.includes(tok)){
      cityLock = rule.city; // Trava na cidade da regra
      uf = rule.forceUF ? rule.uf : (uf || rule.uf); // Força ou usa UF da regra/detectada
      foundCity = rule.city;
      // Recalcula se foi só pelo token especial
      const specialTokens = new Set([tok, ...tokenize(rule.city)]);
      if (parts.every(p => specialTokens.has(p))) {
           queryIsOnlyCity = true; // Trata como busca só pela "cidade" especial
      }
      break;
    }
  }

  // Define os termos restantes para a busca textual
  let finalTerms = new Set(parts);
  if (queryIsOnlyUF && !cityLock) { // Se busca foi só UF
      finalTerms = new Set(); // Não busca por termos textuais
  } else if (queryIsOnlyCity && !uf && !queryIsOnlyUF) { // Se busca foi só Cidade
      finalTerms = new Set(); // Não busca por termos textuais
  } else {
      // Remove termos da UF e/ou Cidade dos termos de busca principais
      const ufTokensToRemove = uf ? [uf, ...UF_MAP[uf].flatMap(x=>tokenize(x))] : [];
      const cityTokensToRemove = foundCity ? [foundCity, ...(CITY_ALIASES[foundCity] || []).flatMap(x => tokenize(x))] : [];
      const tokensToRemove = new Set([...ufTokensToRemove, ...cityTokensToRemove]);
      finalTerms = new Set(parts.filter(p => !tokensToRemove.has(p)));
  }


  // Se travou cidade, garante que UF seja a da cidade (ou a detectada se não mapeada)
  if (cityLock) {
      const ufForLockedCity = CITY_TO_UF_MAP[cityLock];
      if (ufForLockedCity) {
          uf = ufForLockedCity; // Prioriza UF do cityLock
      }
  }


  // Log para depuração
  // console.log(`[DEBUG expandQuery] Q: "${q}" -> UF: ${uf}, CityLock: ${cityLock}, Terms: ${Array.from(finalTerms).join(',')}, IsOnlyUF: ${queryIsOnlyUF}, IsOnlyCity: ${queryIsOnlyCity}`);

  return {terms:finalTerms, uf, cityLock, queryIsOnlyUF, queryIsOnlyCity};
}


/* ========= Busca (Original Modificada para UF/Cidade Refinada + Debug) ========= */
function search(index,q){
  if(!index?.length) return [];
  const qn = norm(q||""); if(!qn) return [];

  const {hasAffix,hasAlter} = detectBrands(qn);
  // Obtém termos (sem UF/Cidade), UF detectada, Cidade detectada, e flags
  const {terms, uf, cityLock, queryIsOnlyUF, queryIsOnlyCity} = expandQuery(q);

  // console.log(`[DEBUG search] Buscando com UF: ${uf}, CityLock: ${cityLock}, Terms: ${Array.from(terms).join(',')}, IsOnlyUF: ${queryIsOnlyUF}, IsOnlyCity: ${queryIsOnlyCity}`); // Log da busca

  const brandFilter = hasAffix || hasAlter;
  const passBrand = it =>
    !brandFilter ||
    (hasAffix && it.url.includes(BRAND_DOMAINS.affix)) ||
    (hasAlter && it.url.includes(BRAND_DOMAINS.alter));
  // Filtro de cidade: se cityLock existe, o item PRECISA ter essa cidade
  const passCity = it => !cityLock || it.cities.has(cityLock);
  // Filtro de UF (usa passUFStrict que verifica o set 'ufs' enriquecido)
  const passUF = it => passUFStrict(it, uf);

  const results = [];

  // 1) Match exato da frase (continua prioritário)
  for(const it of index){
    // Aplica filtros ANTES de verificar match exato
    if(!passBrand(it) || !passUF(it) || !passCity(it)) continue;
    if(it.nameN.includes(qn) || it.urlN.includes(qn)){
      // Score alto + Data
      results.push({it, score:10000 + it.dscore});
      // console.log(`[DEBUG search] Match EXATO: ${it.name}`); // Log match exato
    }
  }

  // 2) Lógica Refinada: Considera UF/Cidade e termos restantes
  for(const it of index){
    // Evita duplicar se já está nos resultados exatos
    if (results.some(r => r.it === it)) continue;

    // Aplica filtros de marca, UF e cidade
    if(!passBrand(it) || !passUF(it) || !passCity(it)) {
        // Log por que foi filtrado (ATIVADO PARA DEBUG)
        if (uf && !passUF(it) && (it.cities.has('belo horizonte') || it.cities.has('uberlandia') || it.cities.has('uberaba'))) {
            console.log(`[DEBUG search] Filtrado por UF: ${it.name} (UF esperada: ${uf}, UFs do item: ${Array.from(it.ufs).join(',')})`);
        }
        // if (cityLock && !passCity(it)) console.log(`[DEBUG search] Filtrado por Cidade: ${it.name} (Cidade esperada: ${cityLock}, Cidades do item: ${Array.from(it.cities).join(',')})`);
        continue;
    }


    let currentScore = 0;
    let termsFoundCount = 0;
    let allTermsFoundInNonGeoQuery = true; // Flag para AND estrito dos termos não-geográficos

    // Caso 1: A busca foi SÓ pela UF OU SÓ pela Cidade
    // Se passou nos filtros geográficos, é um resultado
    if (queryIsOnlyUF || queryIsOnlyCity) {
        currentScore = 500; // Pontuação base para match geográfico
    }
    // Caso 2: A busca tinha termos além da UF/Cidade
    else if (terms.size > 0) {
        let termMatchScore = 0;
        terms.forEach(t => {
            if (containsWord(it.slug, t) || it.kws.has(t)) {
                termMatchScore += 10; // Pontuação por termo
                termsFoundCount++;
            } else {
                allTermsFoundInNonGeoQuery = false; // Se um termo faltar, marca como falso
            }
        });

        // Considera o resultado se PELO MENOS UM termo foi encontrado
        if (termsFoundCount > 0) {
            currentScore = termMatchScore;
            // Bônus se TODOS os termos foram encontrados (comportamento AND original)
            if (allTermsFoundInNonGeoQuery) {
                currentScore += 500;
            }
        } else {
           // Se nenhum termo textual foi encontrado, E não era busca geográfica pura, descarta
           continue;
        }
    }
    // Caso 3: Busca vazia OU busca geográfica sem match (já filtrado antes)
    else if (!queryIsOnlyUF && !queryIsOnlyCity) {
         continue; // Descarta se não tem termos e não era busca geográfica pura
    }


    // Adiciona ao resultado APENAS se teve alguma pontuação
    if (currentScore > 0) {
        // Adiciona score de data
        currentScore += it.dscore / 100;
        // Adiciona um pequeno bônus se a UF/Cidade específica foi encontrada no item
        if (uf && it.ufs.has(uf)) currentScore += 5;
        if (cityLock && it.cities.has(cityLock)) currentScore += 10;

        // Verifica se já não foi adicionado pelo match exato
        if (!results.some(r => r.it === it)) {
             results.push({it, score: currentScore});
             // console.log(`[DEBUG search] Match REFINADO: ${it.name} (Score: ${currentScore})`); // Log match refinado
        }
    }
  }

  // Ordena por score descendente, depois por nome ascendente
  return results
    .sort((a,b)=> b.score - a.score || a.it.name.localeCompare(b.it.name))
    .map(x=>({name:x.it.name, url:x.it.url}));
}


/* ========= Carregamento CSV e Busca (Interface - Original com Correção URL e buildIndex ajustado) ========= */
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
    AFFIX_PDFS = parseAffixCSV(text); // Parseia o CSV (espera 2 colunas)
    AFFIX_INDEX = buildIndex(AFFIX_PDFS); // Constrói o índice (agora associa cidade->UF)
    badge.textContent = `${AFFIX_INDEX.length} PDFs indexados.`;
  } catch (e) {
      badge.textContent = 'Erro ao carregar lista.';
      console.error("Falha no carregamento ou indexação do CSV:", e);
      // Não re-throw para permitir que o resto da UI funcione, mas avisa
  }
}

// Função para parsear CSV (Original - 2 colunas)
function parseAffixCSV(text){
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return []; // Precisa de cabeçalho + dados
  const out = [];
  // Assumindo cabeçalho: name,url
  for (let i=1; i<lines.length; i++){
    const line = lines[i].trim();
    if (!line) continue;
    const idx = line.indexOf(",");
    if (idx === -1) {
       // console.warn(`Linha ${i+1} ignorada: formato CSV inválido (sem vírgula). Conteúdo: ${line}`); // Comentado para reduzir logs
       continue;
    }
    // Simple split assuming no commas within names/URLs themselves
    const name = line.slice(0, idx).trim().replace(/^"|"$/g, ''); // Remove potential quotes
    const url  = line.slice(idx + 1).trim().replace(/^"|"$/g, ''); // Remove potential quotes
    if (name && url && url.toLowerCase().startsWith('http')) { // Added URL validation
        out.push({ name, url }); // Adiciona só name e url
    } else {
        // console.warn(`Linha ${i+1} ignorada: nome, URL inválida ou ausente. Conteúdo: ${line}`); // Comentado para reduzir logs
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


// Função searchAffixPDFs (ATUALIZADA para usar window.search refinado e limpar URLs)
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

  // Usa a função search global (original refinada) passando o índice construído
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
  // Chama a busca local de PDFs (versão original com correção URL e associação UF/Cidade)
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

    // Carrega a lista de PDFs ao iniciar (versão original com correção URL e associação UF/Cidade)
    loadAffixCSV().catch(err => {
      // Erro já logado no console dentro da função
      $('#affixCount').textContent = 'Erro ao carregar lista.';
    });
};

/* ========= Export (browser global) - Mantido caso necessário ========= */
window.buildIndex = buildIndex;
window.search     = search;
