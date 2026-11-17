# Réservations du dîner du monde

Les demandes de table envoyées depuis le site arrivent directement dans un Google Sheet de l'association. Aucune messagerie ne s'ouvre chez le visiteur et aucun service tiers ne voit les données.

## Mise en place (10 minutes, une seule fois)

1. Connectez-vous au compte Google de l'association, puis créez un Google Sheet nommé par exemple « PANGEA · Réservations ».
2. Dans ce tableur, ouvrez **Extensions > Apps Script**.
3. Effacez le contenu du fichier `Code.gs`, collez tout le contenu de `apps-script.gs`, puis enregistrez.
4. En haut du script, réglez `CAPACITE` sur le nombre total de couverts prévu avec le restaurant.
5. Cliquez sur **Déployer > Nouveau déploiement**, puis :
   - type : **Application Web** ;
   - exécuter en tant que : **Moi** ;
   - qui a accès : **Tout le monde**.
6. Autorisez le script quand Google le demande. C'est votre propre script : choisissez « Paramètres avancés », puis « Accéder au projet ».
7. Copiez l'**URL de l'application Web**, qui se termine par `/exec`.
8. Dans `assets/js/premium.js`, collez-la sur la ligne `const RESERVATION_URL = "";`, entre les guillemets.
9. Revenez dans l'éditeur Apps Script, choisissez la fonction **installer** dans la liste en haut, puis cliquez sur **Exécuter**. Autorisez à nouveau si Google le demande. Cela ajoute le menu déroulant de la colonne Statut et active les e-mails automatiques.

Tant que cette ligne reste vide, le formulaire fonctionne en **mode démonstration** : il affiche la confirmation, mais n'enregistre rien.

## Au quotidien

- Chaque demande devient une ligne de la feuille « Réservations ». Son statut est « Reçue », ou « Liste d'attente » quand il ne reste plus assez de couverts.
- Le visiteur reçoit automatiquement un accusé de réception, et l'association un e-mail de notification. Vous pouvez désactiver l'un ou l'autre avec `ENVOYER_ACCUSE` et `PREVENIR_ASSO` en haut du script.
- Pour **confirmer** une table, choisissez son heure dans la colonne **Heure d’arrivée** (de 19 h 00 à 20 h 30), puis `Confirmée` dans la colonne Statut. L'e-mail de confirmation, avec l'heure, l'adresse et les informations pratiques, part dès que les deux sont renseignés, dans n'importe quel ordre.
- La colonne **Importance (interne)** est réservée à l'équipe : choisissez `★★ Importante` (professeur, partenaire…) ou `★★★ Très importante` (direction, invité d'honneur…). La ligne se colore en safran ou en terracotta clair. Cette information n'apparaît dans aucun e-mail. Chaque nouvelle demande arrive en `★ Normale`.
- Si vous changez l'heure d'une table déjà confirmée, le visiteur reçoit un e-mail « Votre horaire a changé ».
- Les informations des e-mails (adresse, prix, paiement, lien du site) se règlent dans le bloc `INFOS` en haut du script. La fonction **apercuEmails** vous envoie les cinq e-mails pour les relire.
- Pour **annuler**, choisissez `Annulée` : le visiteur reçoit un e-mail d'annulation et ses couverts redeviennent disponibles.
- La colonne « E-mail de statut envoyé » garde la trace de chaque envoi. Un même statut n'envoie jamais deux e-mails à la même personne.
- Le formulaire affiche le nombre de places restantes, mis à jour à chaque ouverture.

Si vous modifiez le script plus tard, faites **Déployer > Gérer les déploiements > Modifier > Nouvelle version** pour garder la même URL.

## Données personnelles

Les données (nom, e-mail, téléphone, remarques) servent uniquement à gérer les réservations. Supprimez le tableur après le bilan de l'événement.
