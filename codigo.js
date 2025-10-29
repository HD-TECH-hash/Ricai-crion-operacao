/* ========= Busca Refinada com Scoring ========= */
function search(index, q) {
  if (!index?.length) return [];
  const qn = norm(q || ""); if (!qn) return [];
  const { hasAffix, hasAlter } = detectBrands(qn);
  const { terms, uf, cityLock } = expandQuery(q); // Obtém termos normalizados, UF e cidade (se houver) [cite: 359-370]

  // Filtros básicos (marca, UF estrita, cidade específica)
  const brandFilter = hasAffix || hasAlter;
  const passBrand = it =>
    !brandFilter ||
    (hasAffix && it.url.includes(BRAND_DOMAINS.affix)) || // Verifica se URL contém o domínio da marca [cite: 342]
    (hasAlter && it.url.includes(BRAND_DOMAINS.alter)); // Verifica se URL contém o domínio da marca [cite: 342]
  const passCity = it => !cityLock || containsPhrase(it.slug, cityLock); // Verifica se slug contém a frase da cidade [cite: 346-347, 365]

  const results = [];
  for (const it of index) {
    // Aplica filtros iniciais
    if (!passBrand(it) || !passUFStrict(it, uf) || !passCity(it)) continue; // Pula se não passar nos filtros de marca, UF estrita ou cidade [cite: 371-373, 349-350]

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

        // Prioridade 1: Termo no nome (peso alto)
        // Verifica se o termo está no slug (que inclui palavras do nome e URL) [cite: 353]
        if (containsWord(it.slug, term)) { // Usa containsWord para verificar slug [cite: 346]
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
         if (!termFound && (it.kws.has(term))) { // Verifica se o token existe no conjunto de keywords [cite: 354]
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
      if (uf && it.ufs.has(uf)) { // Verifica se a UF do item bate com a UF da query [cite: 355]
         score += 150;
      }
      // Boost adicional se a cidade específica foi encontrada E estava na query
       if (cityLock && it.cities.has(cityLock)) { // Verifica se a cidade do item bate com a cidade travada da query [cite: 357]
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
