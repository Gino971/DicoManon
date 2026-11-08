# ti'dico de Manouchette

Application de petit dictionnaire FR→IT avec jeu intégré, stylée pour mobile et bureau.

## Files

- `index.html`: Main HTML file containing the structure of the page.
- `style.css`: Basic styles for layout and typography.
- `script.js`: JavaScript logic to interact with the page.

## Usage

Open `index.html` in a web browser to view the application. No build step required.

## Dictionnaire utilisateur

L’application mémorise automatiquement le dictionnaire dans **localStorage** : vos ajouts restent disponibles après fermeture et relance (que ce soit dans le navigateur ou l’app Electron).

L’utilisateur peut alimenter un petit dictionnaire via le formulaire en haut de la page :

1. Saisir un mot français et sa traduction italienne (la même paire peut être ajoutée plusieurs fois pour prendre en compte plusieurs sens).
2. Cliquer sur **➕** (à droite des champs) pour l'enregistrer. Un séparateur visuel sépare le champ d’ajout de l’icône liste.
   - Si on clique sur l’icône ✏️ dans la liste, les deux champs sont préremplis et le bouton devient **✓** pour modifier l’entrée.
3. Le bouton **≡** dans la barre d’outils (en haut à droite) affiche la liste pleine écran.

Pendant le jeu, si votre réponse est correcte mais n’est pas encore dans le dictionnaire, un petit bouton **➕** apparaît pour l’ajouter automatiquement.

## Jeu de traduction

Une fois des mots ajoutés, cliquer sur **Démarrer** pour lancer un quiz :
- L'application propose aléatoirement un mot selon le sens défini.
- Le sens est sélectionnable : français→italien, italien→français ou au hasard.
- L'application affiche un mot dans la langue de départ et attend la traduction dans l’autre.
- Le score affiche « corrects/total » pour suivre les erreurs (par ex. 3/5).
- Si la réponse est incorrecte, un message indique la bonne traduction du mot (toutes les options valides sont listées avec un « ou »). Deux boutons apparaissent : **Ajouter** (pour accepter votre proposition et compter le tour comme correct) ou **Suivant** pour continuer sans modification.
- Un bouton **🔄** (en haut à droite) remet le jeu à zéro et cache l’interface.
- Un bouton **🚪** (en haut à droite) ferme la fenêtre (ou masque l’interface hors d’Electron).

## Electron

This project can also run as an Electron desktop app.

- Install dependencies with `npm install` (already done).
- Start the app with `npm start`.

The Electron entry point is `main.js`; `index.html` acts as the renderer content.

## Mobile

L’interface est stylée pour être responsive et convient aux écrans de téléphone. Pour voir le rendu comme sur un mobile :

- ouvrez `index.html` dans un navigateur de bureau (Chrome, Firefox, Edge...) ;
- activez les outils de développement (`F12` ou clic droit → _Inspecter_) ;
- cliquez sur l’icône « basculer la barre d’outils de l’appareil » (ou _Ctrl+Shift+M_) ;
- choisissez un modèle de téléphone (iPhone, Galaxy, etc.) dans la barre supérieure ;
- rechargez si nécessaire et interagissez comme sur un vrai appareil.

Pour convertir cette application en véritable application mobile, vous pouvez utiliser des solutions comme [Capacitor](https://capacitorjs.com/) ou [Apache Cordova](https://cordova.apache.org/) qui embarquent une WebView autour de la page HTML.

En pratique : 1) placez les fichiers dans un projet Capacitor/Cordova, 2) exécutez le build pour Android ou iOS, 3) installez sur votre téléphone. Le code HTML/CSS/JS reste inchangé.

Le jeu de traduction se déroule maintenant sur une **feuille séparée** : un bouton « Jouer » sur l’écran principal ouvre l’interface de question/réponse, avec un lien de retour en haut pour revenir à l’écran principal.

*Astuce mobile :*
- Le bouton **Quitter** utilise le plugin Capacitor App (ou, en l’absence de celui-ci, la méthode Cordova `navigator.app.exitApp`). Installez‑le :
  ```bash
  npm install @capacitor/app
  npx cap sync
  ```
- **Persistance principale :** le dictionnaire n’est plus gardé uniquement dans `localStorage` ; si le plugin Filesystem est disponible, dès que vous modifiez le dictionnaire il est écrit automatiquement dans `DicoManon.json` au même emplacement (**Documents**). Cela signifie que :
  1. le fichier est accessible avec un gestionnaire de fichiers ou en le copiant depuis l’appareil ;
  2. il survit à la réinstallation de l’application tant que le dossier Documents n’est pas effacé manuellement .
  
Si le plugin n’est pas installé, le comportement reste celui d’avant (localStorage + téléchargements).