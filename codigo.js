// (Dentro da função buildIndex)
const cities=new Set();
for(const [base,alts] of Object.entries(CITY_ALIASES)){
  const all=[base, ...alts.map(norm)];
  if(all.some(a=>containsPhrase(slug,a))) {
      cities.add(base);
      // <<< NOVO: Associa cidade à UF >>>
      const ufForCity = CITY_TO_UF_MAP[base];
      if (ufForCity) {
          ufs.add(ufForCity); // Adiciona a UF correspondente

          // <<< ADICIONE ESTAS LINHAS DE DEBUG >>>
          if (base === 'belo horizonte' || base === 'uberlandia' || base === 'uberaba') {
              console.log(`[DEBUG buildIndex] Associou UF '${ufForCity}' pela cidade '${base}' no arquivo: ${nameRaw}`);
          }
          // <<< FIM DO DEBUG >>>

      }
  }
}
// Adicione um log extra para ver o conjunto final de UFs para arquivos de MG
if (cities.has('belo horizonte') || cities.has('uberlandia') || cities.has('uberaba') || nameN.includes(' minas gerais ') || nameN.includes(' mg ')) {
     console.log(`[DEBUG buildIndex] UFs FINAIS para ${nameRaw}:`, Array.from(ufs));
}
// ------------------------------------

out.push({ /* ... resto do objeto ... */ ufs, cities, /* ... */ });
// (Restante da função buildIndex)
