# Réservations du dîner du monde

Les demandes de table envoyées depuis le site arrivent directement dans un Google Sheet de l'association. Aucune messagerie ne s'ouvre chez le visiteur et aucun service tiers ne voit les données.

## Mise en place (10 minutes, une seule fois)

1. Connectez-vous au compte Google de l'association, puis créez un Google Sheet nommé par exemple « PANGEA · Réservations ».
2. Dans ce tableur, ouvrez **Extensions > Apps Script**.
3. Effacez le contenu du fichier `Code.gs`, collez tout le contenu de `apps-script.gs`, puis enregistrez.
4. En haut du script, réglez `CAPACITE` sur le nombre total de couverts prévu avec le lycée.
5. Cliquez sur **Déployer > Nouveau déploiement**, puis :
   - type : **Application Web** ;
   - exécuter en tant que : **Moi** ;
   - qui a accès : **Tout le monde**.
6. Autorisez le script quand Google le demande. C'est votre propre script : choisissez « Paramètres avancés », puis « Accéder au projet ».
7. Copiez l'**URL de l'application Web**, qui se termine par `/exec`.
8. Dans `assets/js/premium.js`, collez-la sur la ligne `const RESERVATION_URL = "";`, entre les guillemets.

Tant que cette ligne reste vide, le formulaire fonctionne en **mode démonstration** : il affiche la confirmation, mais n'enregistre rien.

## Au quotidien

- Chaque demande devient une ligne de la feuille « Réservations ». Son statut est « Reçue », ou « Liste d'attente » quand il ne reste plus assez de couverts.
- Le visiteur reçoit automatiquement un accusé de réception, et l'association un e-mail de notification. Vous pouvez désactiver l'un ou l'autre avec `ENVOYER_ACCUSE` et `PREVENIR_ASSO` en haut du script.
- Pour **confirmer** une table, écrivez `Confirmée` dans la colonne Statut.
- Pour **annuler**, écrivez `Annulée` : ses couverts redeviennent disponibles.
- Le formulaire affiche le nombre de places restantes, mis à jour à chaque ouverture.

Si vous modifiez le script plus tard, faites **Déployer > Gérer les déploiements > Modifier > Nouvelle version** pour garder la même URL.

## Données personnelles

Les données (nom, e-mail, téléphone, remarques) servent uniquement à gérer les réservations. Supprimez le tableur après le bilan de l'événement.
