/**
 * PANGEA · Réservations du dîner du monde
 * Script Google Apps Script à coller dans le Google Sheet de l'association
 * (Extensions > Apps Script). Mode d'emploi : voir LISEZMOI.md dans ce dossier.
 *
 * Chaque demande envoyée depuis le site devient une ligne de la feuille « Réservations ».
 * Tant qu'il reste des couverts, la demande est « Reçue » ; au-delà, elle passe en « Liste d'attente ».
 * Pour annuler une réservation, écrivez « Annulée » dans la colonne Statut : ses couverts sont libérés.
 */

const CAPACITE = 60;                 // nombre total de couverts (à ajuster avec le lycée)
const COUVERTS_MAX_PAR_DEMANDE = 10;
const ENVOYER_ACCUSE = true;         // accusé de réception automatique au visiteur
const PREVENIR_ASSO = true;          // e-mail à l'association à chaque nouvelle demande
const FEUILLE = 'Réservations';
const ENTETES = ['Date', 'Prénom', 'Nom', 'E-mail', 'Téléphone', 'Couverts', 'Profil', 'Remarque', 'Statut'];

function doGet() {
  return json_({ ok: true, capacite: CAPACITE, restantes: Math.max(0, CAPACITE - couvertsPris_()) });
}

function doPost(e) {
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);                     // deux demandes simultanées ne prennent pas la même place
  try {
    const p = (e && e.parameter) || {};
    if (p.site) return json_({ ok: true, statut: 'Reçue' });           // champ piège à robots
    const prenom = nettoie_(p.prenom), nom = nettoie_(p.nom), email = nettoie_(p.email), tel = nettoie_(p.telephone);
    if (!prenom || !nom || !tel || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json_({ ok: false, erreur: 'champs' });
    const couverts = Math.min(COUVERTS_MAX_PAR_DEMANDE, Math.max(1, parseInt(p.couverts, 10) || 1));
    const restantes = CAPACITE - couvertsPris_();
    const statut = couverts <= restantes ? 'Reçue' : "Liste d'attente";

    feuille_().appendRow([new Date(), prenom, nom, email, "'" + tel.replace(/^'/, ''), couverts, nettoie_(p.profil), nettoie_(p.remarque, 500), statut]);

    const resume = `${prenom} ${nom}\n${couverts} couvert(s)\nTéléphone : ${tel}\nE-mail : ${email}\nProfil : ${nettoie_(p.profil)}\nRemarque : ${nettoie_(p.remarque, 500) || 'aucune'}`;
    if (ENVOYER_ACCUSE) {
      MailApp.sendEmail({
        to: email, name: 'PANGEA',
        subject: statut === 'Reçue' ? 'Votre demande de table pour le dîner du monde' : "Dîner du monde : vous êtes sur liste d'attente",
        body: `Bonjour ${prenom},\n\n` +
          (statut === 'Reçue'
            ? 'Nous avons bien reçu votre demande de table pour le dîner du monde du jeudi 4 février 2027. Nous revenons vers vous très vite pour la confirmer.'
            : "Toutes les places sont réservées pour le moment : votre demande est inscrite sur liste d'attente. Nous vous écrivons dès qu'une table se libère.") +
          `\n\nVotre demande :\n${resume}\n\nÀ très vite,\nL'équipe PANGEA`,
      });
    }
    if (PREVENIR_ASSO) {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), `Nouvelle réservation (${statut}) : ${prenom} ${nom}, ${couverts} couvert(s)`, resume);
    }
    return json_({ ok: true, statut: statut, restantes: Math.max(0, restantes - (statut === 'Reçue' ? couverts : 0)) });
  } catch (err) {
    return json_({ ok: false, erreur: 'serveur' });
  } finally {
    verrou.releaseLock();
  }
}

function feuille_() {
  const classeur = SpreadsheetApp.getActiveSpreadsheet();
  let f = classeur.getSheetByName(FEUILLE);
  if (!f) f = classeur.insertSheet(FEUILLE);
  if (f.getLastRow() === 0) { f.appendRow(ENTETES); f.setFrozenRows(1); f.getRange(1, 1, 1, ENTETES.length).setFontWeight('bold'); }
  return f;
}

function couvertsPris_() {
  const f = feuille_(), n = f.getLastRow() - 1;
  if (n < 1) return 0;
  return f.getRange(2, 6, n, 4).getValues()             // colonnes Couverts … Statut
    .filter((l) => l[3] === 'Reçue' || l[3] === 'Confirmée')
    .reduce((s, l) => s + (Number(l[0]) || 0), 0);
}

function nettoie_(v, max) {
  // retire espaces superflus et neutralise les formules (=, +, -, @) dans le tableur
  let s = String(v || '').trim().slice(0, max || 120);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
