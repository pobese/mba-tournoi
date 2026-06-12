// Script inline bloquant : lit le thème persisté (localStorage 'badnet-theme')
// et pose data-theme sur <html> AVANT le premier paint → aucun flash (FOUC).
// Rendu côté serveur, exécuté avant l'hydratation. Pas de 'use client' nécessaire.
const themeScript = `(function(){try{var s=localStorage.getItem('badnet-theme');var t=s?JSON.parse(s).state.theme:'dark';document.documentElement.setAttribute('data-theme',t==='fluo'?'fluo':'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`

export function ThemeInitializer() {
  // dangerouslySetInnerHTML : contenu 100% statique et contrôlé (aucune entrée
  // utilisateur) — conforme à l'exception de la règle sécurité du projet.
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />
}
