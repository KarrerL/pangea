/**
 * PANGEA · Réservations du dîner du monde
 * Script Google Apps Script à coller dans le Google Sheet de l'association
 * (Extensions > Apps Script). Mode d'emploi : voir LISEZMOI.md dans ce dossier.
 *
 * Chaque demande envoyée depuis le site devient une ligne de la feuille « Réservations ».
 * Tant qu'il reste des couverts, la demande est « Reçue » ; au-delà, elle passe en « Liste d'attente ».
 * Dans le tableur :
 *   - choisissez l'heure d'arrivée dans la colonne « Heure d'arrivée » (menu déroulant) ;
 *   - choisissez « Confirmée » dans la colonne Statut : dès que la ligne a un statut confirmé ET une heure,
 *     le visiteur reçoit l'e-mail de confirmation avec les informations pratiques ;
 *   - si vous changez l'heure d'une table déjà confirmée, le visiteur reçoit un e-mail de mise à jour ;
 *   - « Annulée » envoie un e-mail d'annulation et libère les couverts ;
 *   - la colonne « Importance (interne) » sert à l'équipe seulement (professeur, direction…) : elle colore la ligne
 *     et n'apparaît dans aucun e-mail.
 *
 * Après avoir collé ce script, exécutez UNE FOIS la fonction « installer » (voir LISEZMOI.md).
 */

const CAPACITE = 80;                 // nombre total de couverts
const COUVERTS_MAX_PAR_DEMANDE = 10;
const ENVOYER_ACCUSE = true;         // accusé de réception automatique au visiteur
const PREVENIR_ASSO = true;          // e-mail à l'association à chaque nouvelle demande
const FEUILLE = 'Réservations';
const ENTETES = ['Date', 'Prénom', 'Nom', 'E-mail', 'Téléphone', 'Couverts', 'Profil', 'Remarque', 'Statut', 'E-mail de statut envoyé', 'Heure d’arrivée', 'Importance (interne)'];
const STATUTS = ['Reçue', 'Confirmée', "Liste d'attente", 'Annulée'];
const HEURES = ['19 h 00', '19 h 15', '19 h 30', '19 h 45', '20 h 00', '20 h 15', '20 h 30'];
const COL_STATUT = 9, COL_SUIVI = 10, COL_HEURE = 11, COL_IMPORTANCE = 12;
// Pour l'équipe uniquement : n'apparaît dans aucun e-mail. La ligne se colore selon le niveau.
const IMPORTANCES = ['★ Normale', '★★ Importante (professeur, partenaire…)', '★★★ Très importante (direction, invité d’honneur…)'];
const COULEURS_IMPORTANCE = { [IMPORTANCES[1]]: '#fbe7c2', [IMPORTANCES[2]]: '#f4c7b0' };

/* ---------- Informations pratiques des e-mails ----------
   Une valeur vide fait disparaître la ligne correspondante. */
const INFOS = {
  jour: 'Jeudi', quantieme: '28', mois: 'janvier 2027',
  lieu: 'Restaurant Villa Medusa',
  adresse: '260 chemin de la Tour Carrée, 06700 Saint-Laurent-du-Var',
  prix: '',                                   // ex. '25 € par personne, boissons comprises'
  paiement: '',                               // ex. 'Sur place, en espèces ou par carte'
  site: '',                                   // ex. 'https://www.pangea.fr' : ajoute un lien vers la carte du dîner
  instagram: 'pangeaoff',
};

/* ---------- À exécuter une seule fois : menus déroulants + envois automatiques ---------- */
function installer() {
  const f = feuille_();
  ENTETES.forEach((t, i) => { if (!f.getRange(1, i + 1).getValue()) f.getRange(1, i + 1).setValue(t).setFontWeight('bold'); });
  f.getRange(2, COL_STATUT, f.getMaxRows() - 1, 1).setDataValidation(regle_(STATUTS));
  f.getRange(2, COL_HEURE, f.getMaxRows() - 1, 1).setNumberFormat('@').setDataValidation(regle_(HEURES));
  f.getRange(2, COL_IMPORTANCE, f.getMaxRows() - 1, 1).setDataValidation(regle_(IMPORTANCES));
  // Les lignes importantes se colorent d'elles-mêmes (règles recréées sans doublon à chaque installation)
  const plage = f.getRange(2, 1, f.getMaxRows() - 1, ENTETES.length);
  const lettre = String.fromCharCode(64 + COL_IMPORTANCE);
  const autres = f.getConditionalFormatRules().filter((r) => {
    const cond = r.getBooleanCondition();
    return !(cond && String(cond.getCriteriaValues()[0]).indexOf('$' + lettre + '2') !== -1);
  });
  const nouvelles = Object.keys(COULEURS_IMPORTANCE).map((niveau) => SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(`=$${lettre}2="${niveau}"`).setBackground(COULEURS_IMPORTANCE[niveau]).setRanges([plage]).build());
  f.setConditionalFormatRules(autres.concat(nouvelles));
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'quandStatutChange')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('quandStatutChange').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  SpreadsheetApp.getActive().toast('Menus déroulants et e-mails automatiques installés.', 'PANGEA', 6);
}

/* ---------- Déclenché à chaque modification du tableur ---------- */
function quandStatutChange(e) {
  const r = e && e.range;
  if (!r) return;
  const f = r.getSheet();
  const premiere = r.getColumn(), derniere = premiere + r.getNumColumns() - 1;
  const touche = (col) => premiere <= col && col <= derniere;
  if (f.getName() !== FEUILLE || !(touche(COL_STATUT) || touche(COL_HEURE))) return;

  for (let i = 0; i < r.getNumRows(); i++) {
    const ligne = r.getRow() + i;
    if (ligne < 2) continue;
    const [, prenom, nom, email, , couverts, , , statut, suivi, heure] = f.getRange(ligne, 1, 1, COL_HEURE).getValues()[0];
    if (!email) continue;
    const dejaEnvoye = String(suivi);
    let message = null, trace = '';

    if (statut === 'Confirmée') {
      if (!heure) {
        SpreadsheetApp.getActive().toast(`Choisissez l’heure d’arrivée de ${prenom} ${nom} : l’e-mail de confirmation partira aussitôt.`, 'PANGEA', 8);
        continue;
      }
      if (dejaEnvoye.indexOf('Confirmée') === 0) {
        if (dejaEnvoye.indexOf(`· ${heure} ·`) !== -1) continue;           // même heure : rien à renvoyer
        message = emailHoraire_(prenom, nom, couverts, heure);
      } else {
        message = emailConfirmation_(prenom, nom, couverts, heure);
      }
      trace = `Confirmée · ${heure} · `;
    } else if (statut === 'Annulée') {
      if (dejaEnvoye.indexOf('Annulée') === 0) continue;
      message = emailAnnulation_(prenom, couverts);
      trace = 'Annulée · ';
    } else continue;

    MailApp.sendEmail({ to: String(email), name: 'PANGEA', subject: message.subject, body: message.body, htmlBody: message.html });
    f.getRange(ligne, COL_SUIVI).setValue(trace + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'));
  }
}

/* ======================================================================
   Les e-mails, aux couleurs du site
   ====================================================================== */
const C = { nuit: '#1a1210', encre: '#442f29', doux: '#6e5a4e', creme: '#f8e9cf', fond: '#efe0c4', filet: '#e3cfae', terra: '#cb5731', terraTexte: '#a6472a', or: '#f2be5c', orFonce: '#b9822a' };
const SERIF = "Georgia,'Times New Roman',serif", SANS = 'Arial,Helvetica,sans-serif';
const esc_ = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const etiquette_ = (t, c) => `<p style="margin:0;font:700 10px/1.6 ${SANS};letter-spacing:3px;text-transform:uppercase;color:${c || C.terraTexte}">${t}</p>`;
const plan_ = () => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(INFOS.adresse);

/** Gabarit commun : bandeau nuit, carte crème, pied nuit. */
function gabarit_(titre, intro, contenu, prenom) {
  return `<div style="margin:0;padding:32px 12px;background:${C.fond}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;border-collapse:collapse;background:${C.creme}">
<tr><td style="background:${C.nuit};padding:38px 32px 30px;text-align:center">
  <p style="margin:0;font:700 30px/1 ${SERIF};letter-spacing:9px;color:${C.creme}">PANGEA</p>
  <p style="margin:16px 0 0;font:12px/1 ${SERIF};color:${C.or}">&#10022;&nbsp;&nbsp;&nbsp;<span style="font:700 10px/1 ${SANS};letter-spacing:4px;text-transform:uppercase">Le dîner du monde</span>&nbsp;&nbsp;&nbsp;&#10022;</p>
</td></tr>
<tr><td style="height:6px;background:${C.terra};line-height:6px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:44px 40px 8px;text-align:center">
  <p style="margin:0;font:italic 34px/1.15 ${SERIF};color:${C.terra}">${titre}</p>
  <p style="margin:22px auto 0;max-width:430px;font:16px/1.7 ${SERIF};color:${C.encre}">Bonjour ${esc_(prenom)},<br>${intro}</p>
</td></tr>
<tr><td style="padding:8px 40px 10px">${contenu}</td></tr>
<tr><td style="padding:16px 40px 46px;text-align:center">
  <p style="margin:0;font:italic 24px/1.3 ${SERIF};color:${C.terra}">À très vite à table,</p>
  <p style="margin:6px 0 0;font:15px/1.5 ${SERIF};color:${C.encre}">L’équipe PANGEA</p>
</td></tr>
<tr><td style="background:${C.nuit};padding:26px 32px;text-align:center">
  <p style="margin:0;font:italic 18px/1.4 ${SERIF};color:${C.or}">Le goût, l’amitié et le partage</p>
  <p style="margin:12px 0 0;font:700 10px/1.8 ${SANS};letter-spacing:3px;text-transform:uppercase"><a href="https://www.instagram.com/${INFOS.instagram}/" style="color:${C.creme};text-decoration:none">Instagram @${INFOS.instagram}</a></p>
</td></tr>
</table></div>`;
}

/** Le carton : la date en grand, l'heure, l'adresse, la table. */
function carton_(heure, couverts, prenom, nom) {
  const ligne = (t) => `<p style="margin:6px 0 0;font:16px/1.5 ${SERIF};color:${C.encre}">${t}</p>`;
  let lieu = '';
  if (INFOS.lieu || INFOS.adresse) {
    lieu = `<p style="margin:22px 0 0">${etiquette_('Adresse')}</p>` +
      (INFOS.lieu ? ligne(esc_(INFOS.lieu)) : '') + (INFOS.adresse ? ligne(esc_(INFOS.adresse)) : '') +
      (INFOS.adresse ? `<p style="margin:10px 0 0"><a href="${plan_()}" style="font:700 10px/1 ${SANS};letter-spacing:3px;text-transform:uppercase;color:${C.terraTexte};text-decoration:none;border-bottom:1px solid ${C.terra};padding-bottom:3px">Voir le plan &rarr;</a></p>` : '');
  }
  const extras = [['Prix', INFOS.prix], ['Paiement', INFOS.paiement]].filter(([, v]) => v)
    .map(([k, v]) => `<p style="margin:22px 0 0">${etiquette_(k)}</p>${ligne(esc_(v))}`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 8px;border-collapse:collapse;border:1px solid ${C.orFonce}">
<tr><td style="padding:5px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.terra}">
<tr><td style="padding:30px 24px 32px;text-align:center">
  ${etiquette_(INFOS.jour)}
  <p style="margin:6px 0 0;font:72px/1 ${SERIF};color:${C.terra}">${INFOS.quantieme}</p>
  <p style="margin:4px 0 0;font:20px/1.3 ${SERIF};color:${C.encre}">${INFOS.mois}</p>
  ${heure ? `<p style="margin:22px 0 0">${etiquette_('Arrivée')}</p><p style="margin:6px 0 0;font:28px/1.2 ${SERIF};color:${C.encre}">${esc_(heure)}</p>` : ''}
  ${lieu}
  <p style="margin:22px 0 0">${etiquette_('Votre table')}</p>
  ${ligne(`${esc_(couverts)} couvert${Number(couverts) > 1 ? 's' : ''}, au nom de ${esc_(prenom)} ${esc_(nom)}`)}
  ${extras}
</td></tr></table></td></tr></table>`;
}

/** Une rubrique d'informations pratiques, avec son étoile. */
function rubrique_(titre, texte) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:26px">
<tr><td style="width:30px;vertical-align:top;padding-top:1px;font:15px/1 ${SERIF};color:${C.or}">&#10022;</td>
<td style="vertical-align:top">${etiquette_(titre)}<p style="margin:6px 0 0;font:15px/1.7 ${SERIF};color:${C.encre}">${texte}</p></td></tr></table>`;
}

const RUBRIQUES = () => {
  const r = [
    ['Tenue', 'Tenue correcte exigée. Le dîner du monde est une soirée soignée : venez comme pour une belle table, élégant et à l’aise.'],
    ['Arrivée et retard', 'Merci d’arriver à l’heure indiquée : chaque table est servie à son tour. Un léger retard est accepté dans la limite du raisonnable ; si vous savez que vous serez en retard, prévenez-nous en répondant à cet e-mail pour que nous gardions votre table.'],
    ['Allergies et régimes', 'Tous nos plats sont végétariens, sauf le plov. Une allergie, un régime particulier ? Répondez à cet e-mail dès que possible : la cuisine en tiendra compte.'],
    ['Un empêchement', 'Répondez simplement à cet e-mail pour annuler ou modifier votre réservation. Votre place pourra profiter à une personne en liste d’attente.'],
  ];
  if (INFOS.site) r.splice(2, 0, ['La carte', `Entrée, plat et dessert au choix, venus de neuf pays. <a href="${INFOS.site}/les-cartes.html" style="color:${C.terraTexte}">Découvrir la carte</a>`]);
  return r;
};

function texteBrut_(prenom, phrases) {
  return `Bonjour ${prenom},\n\n${phrases.join('\n\n')}\n\nÀ très vite à table,\nL'équipe PANGEA\nInstagram @${INFOS.instagram}`;
}
function infosTexte_(heure, couverts) {
  return [`${INFOS.jour} ${INFOS.quantieme} ${INFOS.mois}`, heure ? `Arrivée : ${heure}` : '', INFOS.lieu, INFOS.adresse ? `Adresse : ${INFOS.adresse}` : '',
    `Table : ${couverts} couvert(s)`, INFOS.prix ? `Prix : ${INFOS.prix}` : '', INFOS.paiement ? `Paiement : ${INFOS.paiement}` : ''].filter(String).join('\n');
}

function emailConfirmation_(prenom, nom, couverts, heure) {
  const rub = RUBRIQUES();
  const contenu = carton_(heure, couverts, prenom, nom) +
    `<p style="margin:36px 0 0;text-align:center;font:italic 22px/1.3 ${SERIF};color:${C.encre}">Avant de passer à table</p>` +
    rub.map(([t, x]) => rubrique_(t, x)).join('') + '<p style="margin:30px 0 0;font-size:0">&nbsp;</p>';
  return {
    subject: 'Votre table est confirmée · Le dîner du monde',
    html: gabarit_('Votre table est confirmée', 'nous avons le plaisir de vous confirmer votre réservation. Voici tout ce qu’il faut savoir avant de passer à table.', contenu, prenom),
    body: texteBrut_(prenom, ['Bonne nouvelle : votre table est confirmée pour le dîner du monde.', infosTexte_(heure, couverts),
      ...rub.map(([t, x]) => `${t.toUpperCase()}\n${x.replace(/<[^>]+>/g, '')}`)]),
  };
}

function emailHoraire_(prenom, nom, couverts, heure) {
  return {
    subject: 'Nouvel horaire pour votre table · Le dîner du monde',
    html: gabarit_('Votre horaire a changé', `l’heure d’arrivée de votre table a été modifiée. Vous êtes désormais attendu à <strong>${esc_(heure)}</strong>. Tout le reste est inchangé.`,
      carton_(heure, couverts, prenom, nom), prenom),
    body: texteBrut_(prenom, [`L'heure d'arrivée de votre table a été modifiée : vous êtes désormais attendu à ${heure}.`, infosTexte_(heure, couverts)]),
  };
}

function emailAnnulation_(prenom, couverts) {
  const contenu = `<p style="margin:10px 0 30px;text-align:center;font:15px/1.7 ${SERIF};color:${C.doux}">S’il s’agit d’une erreur, répondez simplement à cet e-mail : nous reprendrons votre demande avec plaisir.</p>`;
  return {
    subject: 'Votre réservation est annulée · Le dîner du monde',
    html: gabarit_('Réservation annulée', `votre réservation de ${esc_(couverts)} couvert${Number(couverts) > 1 ? 's' : ''} pour le dîner du monde du ${INFOS.jour.toLowerCase()} ${INFOS.quantieme} ${INFOS.mois} a bien été annulée.`, contenu, prenom),
    body: texteBrut_(prenom, [`Votre réservation de ${couverts} couvert(s) pour le dîner du monde du ${INFOS.jour.toLowerCase()} ${INFOS.quantieme} ${INFOS.mois} a été annulée.`,
      "S'il s'agit d'une erreur, répondez simplement à cet e-mail et nous reprendrons votre demande."]),
  };
}

function emailReception_(prenom, nom, couverts, attente) {
  const contenu = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 30px;border-collapse:collapse;border-top:1px solid ${C.filet};border-bottom:1px solid ${C.filet}">
<tr><td style="padding:20px 0;text-align:center">${etiquette_('Votre demande')}
<p style="margin:8px 0 0;font:17px/1.5 ${SERIF};color:${C.encre}">${esc_(couverts)} couvert${Number(couverts) > 1 ? 's' : ''}, au nom de ${esc_(prenom)} ${esc_(nom)}</p>
<p style="margin:4px 0 0;font:15px/1.5 ${SERIF};color:${C.doux}">${INFOS.jour} ${INFOS.quantieme} ${INFOS.mois}, dès 19 h, à la Villa Medusa</p></td></tr></table>`;
  return attente
    ? { subject: "Vous êtes sur liste d'attente · Le dîner du monde",
        html: gabarit_('Liste d’attente', 'toutes les tables sont réservées pour le moment. Votre demande est inscrite sur liste d’attente : nous vous écrivons dès qu’une place se libère.', contenu, prenom),
        body: texteBrut_(prenom, ["Toutes les tables sont réservées pour le moment : votre demande est inscrite sur liste d'attente. Nous vous écrivons dès qu'une place se libère.", `Votre demande : ${couverts} couvert(s), au nom de ${prenom} ${nom}`]) }
    : { subject: 'Nous avons bien reçu votre demande · Le dîner du monde',
        html: gabarit_('Merci pour votre demande', 'nous avons bien reçu votre demande de table pour le dîner du monde. Nous revenons vers vous très vite pour la confirmer, avec votre heure d’arrivée et toutes les informations pratiques.', contenu, prenom),
        body: texteBrut_(prenom, ['Nous avons bien reçu votre demande de table pour le dîner du monde. Nous revenons vers vous très vite pour la confirmer, avec votre heure d’arrivée et toutes les informations pratiques.', `Votre demande : ${couverts} couvert(s), au nom de ${prenom} ${nom}`]) };
}

/* Envoie les cinq e-mails à vous-même, pour les relire avant les vrais envois. */
function apercuEmails() {
  const moi = Session.getEffectiveUser().getEmail();
  [emailReception_('Prénom', 'Nom', 2, false), emailReception_('Prénom', 'Nom', 2, true), emailConfirmation_('Prénom', 'Nom', 2, '19 h 30'),
   emailHoraire_('Prénom', 'Nom', 2, '20 h 00'), emailAnnulation_('Prénom', 2)]
    .forEach((m) => MailApp.sendEmail({ to: moi, name: 'PANGEA', subject: '[Aperçu] ' + m.subject, body: m.body, htmlBody: m.html }));
}

/* ======================================================================
   Le site : places restantes et nouvelles demandes
   ====================================================================== */
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

    const f = feuille_();
    f.appendRow([new Date(), prenom, nom, email, "'" + tel.replace(/^'/, ''), couverts, nettoie_(p.profil), nettoie_(p.remarque, 500), statut, '', '', IMPORTANCES[0]]);
    const l = f.getLastRow();
    f.getRange(l, COL_STATUT).setDataValidation(regle_(STATUTS));
    f.getRange(l, COL_HEURE).setNumberFormat('@').setDataValidation(regle_(HEURES));
    f.getRange(l, COL_IMPORTANCE).setDataValidation(regle_(IMPORTANCES));

    if (ENVOYER_ACCUSE) {
      const m = emailReception_(prenom, nom, couverts, statut !== 'Reçue');
      MailApp.sendEmail({ to: email, name: 'PANGEA', subject: m.subject, body: m.body, htmlBody: m.html });
    }
    if (PREVENIR_ASSO) {
      const resume = `${prenom} ${nom}\n${couverts} couvert(s)\nTéléphone : ${tel}\nE-mail : ${email}\nProfil : ${nettoie_(p.profil)}\nRemarque : ${nettoie_(p.remarque, 500) || 'aucune'}`;
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

function regle_(liste) {
  return SpreadsheetApp.newDataValidation().requireValueInList(liste, true).setAllowInvalid(false).build();
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
