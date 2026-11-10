import { Component } from '@angular/core';
import { GuideVueComponent } from '../guides/guide-vue.component';
import { ConfigGuide } from '../guides/guide.model';

/**
 * Documentation illustrée de l'espace professionnel (/admin), partie médecin, en français et en lingala.
 *
 * Les captures (public/images/guide-medecin/) viennent de l'application réelle, lancée sur un serveur
 * de démonstration local : base MongoDB en mémoire, patientes et soignants fictifs (compte de
 * démonstration « Dr Aimée AMANI », médecin chef). Aucune donnée réelle n'y figure.
 */
@Component({
  selector: 'app-guide-medecin',
  standalone: true,
  imports: [GuideVueComponent],
  template: `<app-guide-vue [config]="config" />`,
})
export class GuideMedecinComponent {
  config: ConfigGuide = {
    url: '/guide-espace-medecin',
    dossier: 'images/guide-medecin',
    format: 'ecran',
    adresseEcran: 'AMI Santé Connect · /admin',
    captureHero: '03-tableau-de-bord',
    titreOnglet: {
      fr: 'Guide de l’espace médecin · AMI Santé Connect',
      ln: 'Mokanda ya esika ya monganga · AMI Santé Connect',
    },
    badgeIcone: 'fa-user-doctor',
    badge: { fr: 'Espace professionnel · Partie médecin', ln: 'Esika ya basáli · Eteni ya monganga' },
    titre: { fr: 'Guide complet de l’espace', ln: 'Mokanda mobimba ya esika ya' },
    titreAccent: { fr: 'médecin', ln: 'monganga' },
    sousTitre: {
      fr: 'Tous les cas d’utilisation du logiciel AMI Santé Connect pour les médecins, expliqués pas à pas avec des captures d’écran : enregistrement CPN, consultations, rendez-vous, salle de travail et partogramme, vaccination des enfants, messagerie, urgences, relance communautaire, épidémiologie et administration.',
      ln: 'Ndenge nyonso ya kosalela logiciel AMI Santé Connect mpo na ba monganga, elimbolami eteni na eteni na bililingi : kokoma mama na CPN, ba consultation, ba rendez-vous, salle ya kobota mpe partogramme, mangwele ya bana, nsango, makama ya nokinoki, relance na lisanga, épidémiologie mpe boyangeli.',
    },
    boutons: [
      { fragment: 'connexion', icone: 'fa-play', libelle: { fr: 'Commencer le guide', ln: 'Kobanda mokanda' } },
      { fragment: 'partogramme', icone: 'fa-bed-pulse', secondaire: true, libelle: { fr: 'Salle de travail', ln: 'Salle ya kobota' } },
    ],
    avant: {
      titre: { fr: 'Avant de commencer', ln: 'Liboso ya kobanda' },
      cartes: [
        {
          icone: 'fa-id-badge', couleur: 'brand',
          titre: { fr: 'Un compte individuel', ln: 'Compte ya moto moko' },
          texte: {
            fr: 'Chaque soignant reçoit son propre compte (e-mail et mot de passe), créé par le médecin chef. Les comptes partagés sont interdits : chaque action est enregistrée à votre nom.',
            ln: 'Mosáli nyonso azwaka compte na ye moko (e-mail mpe mot de passe), oyo médecin chef afungolaka. Ba compte ya bato mingi epekisami : likambo nyonso osali ekomamaka na nkombo na yo.',
          },
        },
        {
          icone: 'fa-user-doctor', couleur: 'accent',
          titre: { fr: 'Médecin et médecin chef', ln: 'Monganga mpe médecin chef' },
          texte: {
            fr: 'Les médecins ont accès à tout le dossier médical : enregistrement CPN, consultations, salle de travail, conseils. Le médecin chef gère en plus le personnel et participe au groupe de pilotage.',
            ln: 'Ba monganga bakoki kofungola dossier mobimba ya bokolongono : CPN, ba consultation, salle ya kobota, toli. Médecin chef abongisaka lisusu basáli mpe azali na groupe de pilotage.',
          },
        },
        {
          icone: 'fa-user-nurse', couleur: 'amber',
          titre: { fr: 'Sages-femmes et infirmier·ères', ln: 'Ba sage-femme mpe ba infirmier' },
          texte: {
            fr: 'La sage-femme travaille en salle de travail (partogramme, accouchement). L’infirmier·ère voit le suivi en lecture seule et enregistre les vaccinations. Les menus s’adaptent au rôle.',
            ln: 'Sage-femme asalaka na salle ya kobota (partogramme, mbotama). Infirmier amonaka bolandi kaka na kotánga mpe akomaka mangwele. Ba menu ebongwanaka na kolanda mosala ya moto.',
          },
        },
        {
          icone: 'fa-wifi', couleur: 'brand',
          titre: { fr: 'Fonctionne hors connexion', ln: 'Esalaka ata Internet ezali te' },
          texte: {
            fr: 'Après une première connexion en ligne, les dossiers actifs sont copiés sur l’appareil. Sans réseau, vous continuez à travailler jusqu’à 7 jours ; tout est envoyé au retour de la connexion.',
            ln: 'Sima ya kokota mbala ya liboso na Internet, ba dossier oyo ezali kosalema ekopiama na appareil. Soki réseau ezali te, okoki kokoba mosala tii mikolo 7 ; nyonso ekotindama ntango Internet ekozonga.',
          },
        },
        {
          icone: 'fa-lock', couleur: 'rose',
          titre: { fr: 'Verrouillage automatique', ln: 'Ekangamaka yango moko' },
          texte: {
            fr: 'L’écran se verrouille après 10 minutes sans activité. Saisissez votre mot de passe pour reprendre là où vous étiez, même sans réseau.',
            ln: 'Ecran ekangamaka sima ya miniti 10 soki osali eloko te. Koma mot de passe na yo mpo na kokoba esika otikaki, ata réseau ezali te.',
          },
        },
        {
          icone: 'fa-shield-halved', couleur: 'accent',
          titre: { fr: 'Confidentialité', ln: 'Sekele' },
          texte: {
            fr: 'Chaque ouverture de dossier est journalisée. Les dossiers appartiennent à la patiente et sont partagés entre les médecins de l’établissement ; les messages sont chiffrés.',
            ln: 'Mbala nyonso dossier efungwami, ekomamaka na journal. Dossier ezali ya mama mpe ba monganga ya établissement bakabolaka yango ; ba nsango ebatelami (chiffrés).',
          },
        },
      ],
    },
    reperes: {
      titre: { fr: 'Repères de l’écran', ln: 'Bilembo ya ecran' },
      texte: {
        fr: 'Le menu de gauche donne accès à tous les modules (sur téléphone, il s’ouvre avec le bouton ☰). La barre du haut reste visible sur toutes les pages :',
        ln: 'Menu ya loboko ya mwasi epesaka nzela na ba module nyonso (na telefone, efungwamaka na bouton ☰). Barre ya likoló emonanaka na ba lokasa nyonso :',
      },
      items: [
        { icone: 'fa-circle', urgence: true, libelle: { fr: 'Alerte de détresse', ln: 'Libengi ya likama' }, texte: { fr: 'Nombre d’urgences envoyées par les patientes ; ouvre la régulation.', ln: 'Motángo ya makama oyo bamama batindi ; efungolaka régulation.' } },
        { icone: 'fa-volume-high', libelle: { fr: 'Son', ln: 'Lokito' }, texte: { fr: 'Active ou coupe l’alarme sonore des urgences et du partogramme.', ln: 'Kopelisa to koboma lokito ya makama mpe ya partogramme.' } },
        { icone: 'fa-sun', libelle: { fr: 'Thème', ln: 'Pole' }, texte: { fr: 'Mode clair, sombre ou selon l’appareil.', ln: 'Pole ya mwinda, ya molili to lokola appareil.' } },
        { icone: 'fa-paper-plane', libelle: { fr: 'Rappels RDV', ln: 'Bokundoli RDV' }, texte: { fr: 'Envoie les rappels des rendez-vous des 30 prochains jours.', ln: 'Etindaka bokundoli ya ba rendez-vous ya mikolo 30 oyo ezali koya.' } },
        { icone: 'fa-wifi', libelle: { fr: 'En ligne / Hors ligne', ln: 'En ligne / Hors ligne' }, texte: { fr: 'État de la connexion au serveur.', ln: 'Ndenge boyokani na serveur ezali.' } },
        { icone: 'fa-bell', libelle: { fr: 'Notifications', ln: 'Bayebisi' }, texte: { fr: 'Nouveaux messages des patientes et des collègues.', ln: 'Nsango ya sika ya bamama mpe ya baninga.' } },
        { icone: 'fa-plus', libelle: { fr: 'Nouvelle patiente', ln: 'Mama ya sika' }, texte: { fr: 'Raccourci vers l’enregistrement CPN.', ln: 'Nzela ya mbangu mpo na kokoma mama na CPN.' } },
        { icone: 'fa-comments', libelle: { fr: 'Bulle de conversations', ln: 'Bulle ya masolo' }, texte: { fr: 'En bas à droite : répondre aux messages sans quitter la page.', ln: 'Na nse, loboko ya mobali : koyanola nsango kozanga kotika lokasa.' } },
      ],
    },
    parties: [
      // ------------------------------------------------------------------ Prise en main
      {
        titre: { fr: 'Prise en main', ln: 'Kobanda mosala' },
        icone: 'fa-rocket',
        etapes: [
          {
            id: 'connexion', icone: 'fa-right-to-bracket',
            titre: { fr: 'Se connecter à l’espace professionnel', ln: 'Kokota na esika ya basáli' },
            intro: {
              fr: 'L’espace professionnel s’ouvre depuis le lien « Espace professionnel » en bas du site, ou directement à l’adresse /admin/connexion.',
              ln: 'Esika ya basáli efungwamaka na lien « Espace professionnel » na nse ya site, to mbala moko na adresse /admin/connexion.',
            },
            points: [
              { fr: 'Saisissez l’e-mail professionnel communiqué par le médecin chef, puis votre mot de passe (l’icône en forme d’œil l’affiche).', ln: 'Koma e-mail ya mosala oyo médecin chef apesaki yo, sima mot de passe na yo (elembo ya liso elakisaka yango).' },
              { fr: 'Cliquez sur « Se connecter ». Si vous travaillez dans plusieurs établissements, choisissez celui de la journée puis « Entrer dans cet établissement ».', ln: 'Finá « Se connecter ». Soki osalaka na ba établissement ebele, pona oyo ya lelo sima « Entrer dans cet établissement ».' },
              { fr: 'À la première connexion sur un appareil, restez en ligne quelques minutes : les dossiers sont copiés pour le travail hors connexion.', ln: 'Mbala ya liboso na appareil moko, tikala na Internet miniti moke : ba dossier ekopiama mpo na mosala soki Internet ezali te.' },
              { fr: 'Pour quitter, cliquez sur l’icône de sortie à côté de votre nom, en bas du menu.', ln: 'Mpo na kobima, finá elembo ya kobima pembeni ya nkombo na yo, na nse ya menu.' },
            ],
            captures: [
              { fichier: '01-connexion-vide', legende: { fr: 'La page de connexion', ln: 'Lokasa ya kokota' } },
              { fichier: '01-connexion-remplie', legende: { fr: 'E-mail et mot de passe saisis', ln: 'E-mail mpe mot de passe ekomami' } },
            ],
            attention: { fr: 'Ne prêtez jamais votre compte. Sur un poste partagé, déconnectez-vous toujours à la fin de votre service.', ln: 'Kodefisa compte na yo na moto te. Na ordinateur ya bato mingi, bima ntango nyonso soki osilisi mosala.' },
          },
          {
            id: 'acces-rapide', icone: 'fa-bolt',
            titre: { fr: 'Accès rapide et navigation', ln: 'Nzela ya mbangu mpe kotambola' },
            intro: {
              fr: 'Après la connexion, la page « Accès rapide » propose de grandes tuiles colorées vers les actions les plus fréquentes.',
              ln: 'Sima ya kokota, lokasa « Accès rapide » elakisaka ba carré minene ya langi mpo na misala oyo esalemaka mingi.',
            },
            points: [
              { fr: 'Cliquez sur une tuile : Urgences, Enregistrement CPN, Accouchement, Enfants vaccinés, Ajout soignant, Publier un article, Envoyer un message, Écrire à un collègue.', ln: 'Finá carré moko : Urgences, Enregistrement CPN, Accouchement, Enfants vaccinés, Ajout soignant, Publier un article, Envoyer un message, Écrire à un collègue.' },
              { fr: 'Le menu de gauche liste tous les modules ; un badge vert indique le nombre d’éléments à traiter (messages non lus, alertes, doublons).', ln: 'Menu ya loboko ya mwasi elakisi ba module nyonso ; badge ya mobesu elakisi motángo ya makambo ya kosala (nsango oyo batángi te, ba alerte, ba doublon).' },
              { fr: 'Sur téléphone ou tablette, le menu s’ouvre avec le bouton ☰ et une barre d’onglets apparaît en bas (Tableau de bord, CPN, Rendez-vous, Accouchement).', ln: 'Na telefone to tablette, menu efungwamaka na bouton ☰ mpe barre ya ba onglet ebimaka na nse (Tableau de bord, CPN, Rendez-vous, Accouchement).' },
            ],
            captures: [
              { fichier: '02-acces-rapide', legende: { fr: 'Les tuiles d’accès rapide', ln: 'Ba carré ya nzela ya mbangu' } },
              { fichier: '26-mobile', format: 'telephone', legende: { fr: 'L’espace médecin sur téléphone', ln: 'Esika ya monganga na telefone' } },
              { fichier: '26-mobile-menu', format: 'telephone', legende: { fr: 'Le menu ouvert sur téléphone', ln: 'Menu efungwami na telefone' } },
            ],
          },
          {
            id: 'tableau-de-bord', icone: 'fa-house',
            titre: { fr: 'Le tableau de bord', ln: 'Tableau de bord' },
            intro: {
              fr: 'Le tableau de bord résume l’activité de l’établissement, calculée sur les dossiers réellement enregistrés.',
              ln: 'Tableau de bord elakisi bokuse ya misala ya établissement, na kotalaka ba dossier oyo ekomami mpenza.',
            },
            points: [
              { fr: 'En haut : les soignants connectés en ce moment, puis le choix de la période (aujourd’hui, 7 jours, mois, trimestre, année, personnalisée) et de la province.', ln: 'Likoló : basáli oyo bazali en ligne sikoyo, sima kopona ntango (lelo, mikolo 7, sanza, sanza misato, mbula, oyo olingi) mpe province.' },
              { fr: 'Les cartes d’indicateurs : CPN en retard, accouchements, doses de vaccin en retard, enfants zéro-dose, tâches RECO échues, alertes urgentes. Cliquez sur une carte pour ouvrir la liste correspondante.', ln: 'Ba carte ya bilembo : CPN na retard, mbotama, mangwele na retard, bana zéro-dose, misala ya RECO oyo eleki ntango, makama ya nokinoki. Finá carte mpo na kofungola liste na yango.' },
              { fr: 'Plus bas : la répartition CPN1 à CPN4 du mois, les graphiques mensuels et la carte des patientes par province.', ln: 'Na nse : bokaboli ya CPN1 tii CPN4 ya sanza, ba graphique ya sanza na sanza mpe carte ya bamama na kolanda province.' },
              { fr: 'La barre « Rechercher une analyse » (Ctrl + K) trouve directement un indicateur : CPN 4, Penta 3, hémorragie, couverture BCG…', ln: 'Barre « Rechercher une analyse » (Ctrl + K) ezwaka mbala moko elembo : CPN 4, Penta 3, hémorragie, couverture BCG…' },
              { fr: '« Exporter » télécharge les indicateurs affichés.', ln: '« Exporter » ekitisaka bilembo oyo emonani.' },
            ],
            captures: [
              { fichier: '03-tableau-de-bord', legende: { fr: 'Accueil du tableau de bord', ln: 'Ebandeli ya tableau de bord' } },
              { fichier: '03-tableau-de-bord-indicateurs', legende: { fr: 'Indicateurs et CPN du mois', ln: 'Bilembo mpe ba CPN ya sanza' } },
              { fichier: '03-tableau-de-bord-graphiques', legende: { fr: 'Patientes par province de résidence', ln: 'Bamama na kolanda province bavandaka' } },
              { fichier: '25-mode-sombre', legende: { fr: 'Le tableau de bord en mode sombre', ln: 'Tableau de bord na pole ya molili' } },
            ],
          },
          {
            id: 'profil', icone: 'fa-id-card',
            titre: { fr: 'Mon profil', ln: 'Profil na ngai' },
            intro: {
              fr: 'Cliquez sur votre nom en haut de l’écran pour ouvrir votre profil professionnel.',
              ln: 'Finá nkombo na yo na likoló ya ecran mpo na kofungola profil na yo ya mosala.',
            },
            points: [
              { fr: 'Changez votre photo (visage de face, fond neutre) : elle apparaît dans les messages et la liste des soignants en ligne.', ln: 'Bongolá foto na yo (elongi na liboso, fond ya pete) : emonanaka na ba nsango mpe na liste ya basáli en ligne.' },
              { fr: 'Complétez votre identité, votre profession (n° d’inscription à l’Ordre, grade, spécialité) et votre téléphone, puis enregistrez.', ln: 'Tondisá identité na yo, mosala na yo (nimero ya Ordre, grade, spécialité) mpe telefone, sima enregistrer.' },
              { fr: 'Changez votre mot de passe depuis la même page.', ln: 'Bongolá mot de passe na yo na lokasa yango moko.' },
            ],
            captures: [
              { fichier: '23-profil', legende: { fr: 'Le profil du médecin', ln: 'Profil ya monganga' } },
            ],
          },
        ],
      },
      // ------------------------------------------------------------------ Suivi prénatal
      {
        titre: { fr: 'Suivi prénatal (CPN)', ln: 'Kolanda zemi (CPN)' },
        icone: 'fa-person-pregnant',
        etapes: [
          {
            id: 'patientes', icone: 'fa-magnifying-glass',
            titre: { fr: 'Rechercher une patiente', ln: 'Koluka mama' },
            intro: {
              fr: 'Avant de créer un dossier, recherchez toujours la patiente : un seul dossier par femme, partagé entre tous les médecins.',
              ln: 'Liboso ya kofungola dossier, luká ntango nyonso mama : dossier moko kaka mpo na mwasi moko, oyo ba monganga nyonso bakabolaka.',
            },
            points: [
              { fr: 'Ouvrez « Patientes » dans le menu. La liste affiche la photo, l’âge, le téléphone masqué, la résidence, l’âge gestationnel, le prochain rendez-vous et le statut.', ln: 'Fungolá « Patientes » na menu. Liste elakisi foto, mbula, telefone ebombami, esika avandaka, bomoi ya zemi, rendez-vous oyo ezali koya mpe statut.' },
              { fr: 'Tapez un identifiant AC-PAT, un nom, un postnom, un prénom ou un numéro de téléphone, choisissez au besoin une province ou un statut, puis « Rechercher ».', ln: 'Koma identifiant AC-PAT, nkombo, postnom, prénom to nimero ya telefone, pona soki esengeli province to statut, sima « Rechercher ».' },
              { fr: 'Un bandeau orange signale les correspondances possibles : vérifiez qu’il ne s’agit pas de la même personne avant toute création.', ln: 'Bandeau ya orange elakisaka bato oyo bakokani : talá malamu soki ezali moto moko te liboso ya kofungola dossier ya sika.' },
              { fr: 'Cliquez sur « Ouvrir » pour accéder au dossier. Chaque ouverture est enregistrée dans le journal d’audit.', ln: 'Finá « Ouvrir » mpo na kokota na dossier. Mbala nyonso ofungoli, ekomamaka na journal d’audit.' },
            ],
            captures: [
              { fichier: '04-patientes', legende: { fr: 'La liste des patientes', ln: 'Liste ya bamama' } },
              { fichier: '04-patientes-recherche', legende: { fr: 'Recherche par nom avec avertissement de correspondance', ln: 'Koluka na nkombo, na bokebisi ya bato bakokani' } },
            ],
          },
          {
            id: 'enregistrement-cpn', icone: 'fa-file-circle-plus',
            titre: { fr: 'Enregistrer une nouvelle patiente (CPN)', ln: 'Kokoma mama ya sika (CPN)' },
            acces: { fr: 'médecins seulement.', ln: 'ba monganga kaka.' },
            intro: {
              fr: 'Le formulaire d’enregistrement CPN crée le dossier prénatal en sept étapes. L’identifiant AC-PAT est attribué automatiquement à l’enregistrement.',
              ln: 'Formulaire ya enregistrement CPN efungolaka dossier ya zemi na biteni nsambo. Identifiant AC-PAT epesamaka yango moko ntango bakomi.',
            },
            points: [
              { fr: '1. Identité : nom, postnom, prénom, date de naissance (ou âge déclaré), état civil, occupation, photo de la patiente (obligatoire), profil biologique, contact, résidence, DDR. Créez aussi le mot de passe de son application mobile.', ln: '1. Identité : nkombo, postnom, prénom, mokolo ya mbotama (to mbula alobi), etat civil, mosala, foto ya mama (esengeli), profil biologique, contact, esika avandaka, DDR. Bongisá mpe mot de passe ya application na ye ya telefone.' },
              { fr: '2. Antécédents : médicaux (HTA, diabète, drépanocytose…), gynéco-chirurgicaux (césarienne, fibrome…) et obstétricaux (gestité, parité).', ln: '2. Antécédents : bokono ya kala (HTA, sukali, drépanocytose…), gynéco-chirurgicaux (césarienne, fibrome…) mpe obstétricaux (gestité, parité).' },
              { fr: '3. Mesures préventives (VAT, SP, MILD, vermifuge, dépistages, PTME), 4. Laboratoire, 5. Échographie (facultative), 6. Éléments de référence (signes justifiant d’orienter la femme).', ln: '3. Mesures préventives (VAT, SP, MILD, vermifuge, dépistages, PTME), 4. Laboratoire, 5. Échographie (soki ezali), 6. Éléments de référence (bilembo oyo esengi kotinda mwasi epai mosusu).' },
              { fr: '7. Rendez-vous : fixez le premier rendez-vous, puis « Prévisualiser la fiche » pour relire la fiche CPN avant de l’enregistrer.', ln: '7. Rendez-vous : bongisá rendez-vous ya liboso, sima « Prévisualiser la fiche » mpo na kotánga lisusu fiche CPN liboso ya kokoma yango.' },
              { fr: 'À droite, la datation estimée (âge gestationnel, DPA) se calcule en direct ; les contrôles de cohérence et les doublons potentiels sont vérifiés automatiquement.', ln: 'Na loboko ya mobali, datation (bomoi ya zemi, DPA) esalemaka mbala moko ; bokeseni mpe ba doublon etalelamaka yango moko.' },
            ],
            captures: [
              { fichier: '05-enregistrement-cpn', legende: { fr: 'Les sept étapes de l’enregistrement', ln: 'Biteni nsambo ya enregistrement' } },
              { fichier: '05-cpn-identite', legende: { fr: 'Étape 1 : identité et photo de la patiente', ln: 'Eteni 1 : identité mpe foto ya mama' } },
              { fichier: '05-cpn-antecedents', legende: { fr: 'Étape 2 : antécédents', ln: 'Eteni 2 : antécédents' } },
              { fichier: '05-cpn-rendez-vous', legende: { fr: 'Étape 7 : premier rendez-vous et éléments manquants', ln: 'Eteni 7 : rendez-vous ya liboso mpe makambo ezangi' } },
            ],
            astuce: { fr: 'Une étape non ouverte apparaît en rouge « À compléter ». L’encadré jaune de l’étape 7 liste ce qui manque encore avant l’enregistrement.', ln: 'Eteni oyo ofungoli te emonanaka na motane « À compléter ». Cadre ya jaune ya eteni 7 elakisi makambo oyo ezangi naino liboso ya kokoma.' },
          },
          {
            id: 'dossier-patiente', icone: 'fa-folder-open',
            titre: { fr: 'Le dossier de la patiente', ln: 'Dossier ya mama' },
            intro: {
              fr: 'Le dossier réunit l’identité, la grossesse en cours, les risques, les consultations, les rendez-vous et l’historique des accès.',
              ln: 'Dossier esangisi identité, zemi oyo ezali, makama, ba consultation, ba rendez-vous mpe lisolo ya bato oyo bafungolaki yango.',
            },
            points: [
              { fr: 'En-tête : photo, identifiant AC-PAT, âge, téléphone, adresse et statut. Boutons « Nouvelle consultation », « Carte patiente » (PDF recto-verso avec QR code), « Écrire » (message à la patiente) et « Supprimer » (médecin chef).', ln: 'Likoló : foto, identifiant AC-PAT, mbula, telefone, adresse mpe statut. Ba bouton « Nouvelle consultation », « Carte patiente » (PDF ngámbo mibale na QR code), « Écrire » (nsango na mama) mpe « Supprimer » (médecin chef).' },
              { fr: 'Onglet « Résumé » : DPA calculée, âge gestationnel du jour, DDR et frise des trimestres. « Corriger la datation » et « Issue de grossesse » sont dans le même cadre.', ln: 'Onglet « Résumé » : DPA, bomoi ya zemi ya lelo, DDR mpe nzela ya ba trimestre. « Corriger la datation » mpe « Issue de grossesse » ezali na cadre yango moko.' },
              { fr: 'Le cadre « Risques et antécédents » rappelle allergies, césariennes et antécédents (HTA…) ; « Maternité & enfants » permet d’admettre la patiente en salle de travail.', ln: 'Cadre « Risques et antécédents » ekundolaka allergie, césarienne mpe bokono ya kala (HTA…) ; « Maternité & enfants » epesaka nzela ya kokotisa mama na salle ya kobota.' },
              { fr: 'Onglet « Consultations » : toutes les visites avec l’auteur, l’âge gestationnel, le poids, la TA et le motif. Onglet « Historique & accès » : qui a ouvert ou modifié le dossier, et quand.', ln: 'Onglet « Consultations » : ba visite nyonso na nkombo ya monganga, bomoi ya zemi, kilo, TA mpe ntina. Onglet « Historique & accès » : nani afungolaki to abongolaki dossier, mpe ntango nini.' },
            ],
            captures: [
              { fichier: '06-dossier-patiente', legende: { fr: 'Résumé du dossier et grossesse en cours', ln: 'Bokuse ya dossier mpe zemi oyo ezali' } },
              { fichier: '06-dossier-risques', legende: { fr: 'Risques, antécédents et fiche CPN', ln: 'Makama, antécédents mpe fiche CPN' } },
              { fichier: '06-dossier-consultations', legende: { fr: 'Onglet « Consultations »', ln: 'Onglet « Consultations »' } },
              { fichier: '06-dossier-historique', legende: { fr: 'Onglet « Historique & accès »', ln: 'Onglet « Historique & accès »' } },
            ],
          },
          {
            id: 'consultation', icone: 'fa-stethoscope',
            titre: { fr: 'Faire une consultation prénatale', ln: 'Kosala consultation ya zemi' },
            acces: { fr: 'médecins seulement.', ln: 'ba monganga kaka.' },
            intro: {
              fr: 'Depuis le dossier, cliquez sur « Nouvelle consultation ». L’auteur est toujours le médecin connecté, enregistré par le serveur.',
              ln: 'Na dossier, finá « Nouvelle consultation ». Mokomi azali ntango nyonso monganga oyo akoti, serveur nde ekomaka yango.',
            },
            points: [
              { fr: 'Visite : type (première CPN, suivi, non programmée), date et heure réelles, motif et plaintes.', ln: 'Visite : lolenge (CPN ya liboso, bolandi, oyo ebongisamaki te), mokolo mpe ngonga ya solo, ntina mpe mpasi oyo mama alobi.' },
              { fr: 'Constantes : poids, TA, température, FC, SaO2, FR, périmètre brachial, hauteur utérine, BCF. Puis l’examen CPN (malnutrition, infection, pré-éclampsie, seins, risque chirurgical) par Oui / Non.', ln: 'Constantes : kilo, TA, température, FC, SaO2, FR, périmètre brachial, hauteur utérine, BCF. Sima examen CPN (malnutrition, infection, pré-éclampsie, mabele, risque chirurgical) na Oui / Non.' },
              { fr: 'À droite, l’âge gestationnel à la date de la visite s’affiche automatiquement.', ln: 'Na loboko ya mobali, bomoi ya zemi na mokolo ya visite emonanaka yango moko.' },
              { fr: '« Enregistrer le brouillon » pour reprendre plus tard ; « Finaliser et signer » pour clôturer. Le prochain rendez-vous saisi est ajouté à l’agenda.', ln: '« Enregistrer le brouillon » mpo na kozongela sima ; « Finaliser et signer » mpo na kosilisa. Rendez-vous oyo ekomami ekotiama na agenda.' },
            ],
            captures: [
              { fichier: '07-nouvelle-consultation', legende: { fr: 'Nouvelle consultation : visite et constantes', ln: 'Consultation ya sika : visite mpe constantes' } },
              { fichier: '07-nouvelle-consultation-suite', legende: { fr: 'Examen CPN par Oui / Non', ln: 'Examen CPN na Oui / Non' } },
              { fichier: '07-consultation-finalisee', legende: { fr: 'Consultation finalisée (lecture seule)', ln: 'Consultation esili (kotánga kaka)' } },
            ],
            attention: { fr: 'Une consultation finalisée ne peut plus être modifiée : ajoutez un addendum pour compléter ou corriger, la note initiale reste conservée.', ln: 'Consultation oyo esili ekoki kobongwana lisusu te : bakisá addendum mpo na kobakisa to kobongisa ; maloba ya liboso etikalaka.' },
          },
          {
            id: 'rendez-vous', icone: 'fa-calendar-check',
            titre: { fr: 'Rendez-vous et rappels', ln: 'Ba rendez-vous mpe bokundoli' },
            intro: {
              fr: 'L’agenda réunit les rendez-vous CPN et les séances de vaccination des enfants de l’établissement.',
              ln: 'Agenda esangisi ba rendez-vous ya CPN mpe ba séance ya mangwele ya bana ya établissement.',
            },
            points: [
              { fr: 'Les compteurs du haut : rendez-vous du jour, des 7 prochains jours, effectués et absences sur 30 jours.', ln: 'Ba compteur ya likoló : ba rendez-vous ya lelo, ya mikolo 7 oyo ezali koya, oyo esalemaki mpe bato bazangaki na mikolo 30.' },
              { fr: 'Filtrez « À venir », « Aujourd’hui », « Absences » ou « Tous ». Chaque ligne indique la patiente (ou l’enfant), le motif, l’heure et le rappel envoyé.', ln: 'Pona « À venir », « Aujourd’hui », « Absences » to « Tous ». Molongo moko na moko elakisi mama (to mwana), ntina, ngonga mpe bokundoli oyo etindamaki.' },
              { fr: 'Cliquez sur « Dossier » pour ouvrir la patiente ; reportez ou annulez un rendez-vous depuis son dossier (l’ancien créneau et le motif sont conservés).', ln: 'Finá « Dossier » mpo na kofungola mama ; kobongola mokolo to koboma rendez-vous na dossier na ye (ngonga ya kala mpe ntina etikalaka).' },
              { fr: 'Le bouton « Rappels RDV » de la barre du haut envoie un rappel discret (sans détail médical) aux patientes ayant un rendez-vous dans les 30 jours, si elles l’ont accepté.', ln: 'Bouton « Rappels RDV » ya likoló etindaka bokundoli ya sekele (kozanga makambo ya bokono) na bamama oyo bazali na rendez-vous na mikolo 30, soki bandimaki.' },
            ],
            captures: [
              { fichier: '08-rendez-vous', legende: { fr: 'L’agenda des rendez-vous', ln: 'Agenda ya ba rendez-vous' } },
              { fichier: '03-rappels-rdv', legende: { fr: 'Envoyer les rappels de rendez-vous', ln: 'Kotinda bokundoli ya ba rendez-vous' } },
            ],
          },
          {
            id: 'doublons', icone: 'fa-clone',
            titre: { fr: 'Traiter les doublons', ln: 'Kobongisa ba doublon' },
            intro: {
              fr: 'Quand deux dossiers semblent concerner la même femme, ils apparaissent dans « Doublons » avec un score de similarité. Aucune fusion n’est automatique.',
              ln: 'Soki ba dossier mibale emonani lokola ya mwasi moko, ebimaka na « Doublons » na score ya bokokani. Eloko moko te esangisamaka yango moko.',
            },
            points: [
              { fr: 'Comparez les deux dossiers champ par champ (nom, postnom, prénom, âge, téléphone, quartier, pièce d’identité).', ln: 'Kokanisa ba dossier mibale esika na esika (nkombo, postnom, prénom, mbula, telefone, quartier, pièce d’identité).' },
              { fr: 'Saisissez le motif de la décision, puis choisissez « Même personne — fusionner », « Personnes différentes » ou « Plus tard ».', ln: 'Koma ntina ya mokano, sima pona « Même personne — fusionner », « Personnes différentes » to « Plus tard ».' },
            ],
            captures: [
              { fichier: '19-doublons', legende: { fr: 'Comparaison de deux dossiers', ln: 'Kokanisa ba dossier mibale' } },
            ],
          },
        ],
      },
      // ------------------------------------------------------------------ Maternité
      {
        titre: { fr: 'Maternité et accouchement', ln: 'Maternité mpe mbotama' },
        icone: 'fa-bed-pulse',
        etapes: [
          {
            id: 'salle-de-travail', icone: 'fa-bed-pulse',
            titre: { fr: 'La salle de travail', ln: 'Salle ya kobota' },
            acces: { fr: 'médecins et sages-femmes.', ln: 'ba monganga mpe ba sage-femme.' },
            intro: {
              fr: 'La salle de travail suit en direct toutes les parturientes admises : phase du travail, zone du partogramme et alertes.',
              ln: 'Salle ya kobota elandaka na ntango wana basi nyonso oyo bakotisami : phase ya travail, zone ya partogramme mpe ba alerte.',
            },
            points: [
              { fr: 'Cliquez sur « Admettre une patiente » : choisissez son dossier CPN (identité et antécédents pré-remplis) ou faites une admission directe si elle n’a pas été suivie ici.', ln: 'Finá « Admettre une patiente » : pona dossier na ye ya CPN (identité mpe antécédents ekomami déjà) to salá admission directe soki alandamaki awa te.' },
              { fr: 'Les compteurs indiquent les femmes en travail, en post-partum, en zone rouge et les alertes critiques à prendre en charge.', ln: 'Ba compteur elakisi basi oyo bazali na travail, na post-partum, na zone rouge mpe ba alerte ya makasi ya kosimba.' },
              { fr: '« Alertes à prendre en charge » : cliquez sur « Prendre en charge » pour signaler que vous vous en occupez, ou sur « Dossier » pour l’ouvrir.', ln: '« Alertes à prendre en charge » : finá « Prendre en charge » mpo na koyebisa ete ozali kosala yango, to « Dossier » mpo na kofungola.' },
              { fr: 'Le tableau des dossiers montre la dernière mesure, la zone (verte, jaune, rouge) et le nombre d’alertes. Filtrez « En cours », « Clôturé » ou « Tous ».', ln: 'Tableau ya ba dossier elakisi mesure ya suka, zone (verte, jaune, rouge) mpe motángo ya ba alerte. Pona « En cours », « Clôturé » to « Tous ».' },
            ],
            captures: [
              { fichier: '09-salle-travail', legende: { fr: 'Salle de travail : alertes et dossiers en cours', ln: 'Salle ya kobota : ba alerte mpe ba dossier oyo ezali' } },
            ],
            attention: { fr: 'Une alerte rouge déclenche une alarme sonore et notifie les médecins de l’établissement. Gardez le son activé pendant la garde.', ln: 'Alerte ya motane ebetaka alarme mpe eyebisaka ba monganga ya établissement. Tiká lokito epela ntango ozali na garde.' },
          },
          {
            id: 'partogramme', icone: 'fa-chart-line',
            titre: { fr: 'Le partogramme et ses alertes', ln: 'Partogramme mpe ba alerte na yango' },
            acces: { fr: 'médecins et sages-femmes.', ln: 'ba monganga mpe ba sage-femme.' },
            intro: {
              fr: 'L’onglet « III · Travail & partogramme » du dossier d’accouchement trace la courbe du travail et détecte automatiquement les situations à risque.',
              ln: 'Onglet « III · Travail & partogramme » ya dossier ya mbotama ebendaka courbe ya travail mpe emonaka yango moko makambo ya likama.',
            },
            points: [
              { fr: 'En haut du dossier : la patiente, sa phase (latence ou active), sa zone et le nombre d’alertes. « Points d’attention » reprend le suivi prénatal (dernière CPN, échographie, laboratoire).', ln: 'Likoló ya dossier : mama, phase na ye (latence to active), zone na ye mpe motángo ya ba alerte. « Points d’attention » ezongisaka bolandi ya zemi (CPN ya suka, échographie, laboratoire).' },
              { fr: 'Saisissez chaque mesure : BCF, dilatation, effacement du col, contractions sur 10 minutes, durée, pouls, TA, température, membranes, liquide amniotique, ocytocine, médicaments IV… puis « Enregistrer la mesure ».', ln: 'Koma mesure moko na moko : BCF, dilatation, effacement ya col, contractions na miniti 10, ntango, pouls, TA, température, membranes, mai ya zemi, ocytocine, nkisi na IV… sima « Enregistrer la mesure ».' },
              { fr: 'Le tableau horaire et les courbes (BCF, dilatation avec lignes d’alerte et d’action) se remplissent automatiquement.', ln: 'Tableau ya ngonga mpe ba courbe (BCF, dilatation na ba ligne ya alerte mpe ya action) etondaka yango moko.' },
              { fr: 'Alertes : BCF anormal (< 120 ou > 160), passage en zone jaune (ligne d’alerte), stagnation de la dilatation plus de 2 h, zone rouge (ligne d’action). Chaque alerte s’affiche avec l’heure et un bouton « Prendre en charge ».', ln: 'Ba alerte : BCF ya malamu te (< 120 to > 160), kokota na zone jaune (ligne ya alerte), dilatation etelemi koleka ngonga 2, zone rouge (ligne ya action). Alerte moko na moko emonanaka na ngonga mpe bouton « Prendre en charge ».' },
            ],
            captures: [
              { fichier: '10-partogramme-alertes', legende: { fr: 'Dossier en zone jaune : stagnation détectée', ln: 'Dossier na zone jaune : dilatation etelemi' } },
              { fichier: '10-partogramme-saisie', legende: { fr: 'Saisie d’une mesure et tableau de la phase de latence', ln: 'Kokoma mesure mpe tableau ya phase ya latence' } },
              { fichier: '10-partogramme-courbe', legende: { fr: 'Courbe des bruits du cœur fœtal (BCF)', ln: 'Courbe ya motema ya mwana (BCF)' } },
            ],
            astuce: { fr: 'Après la naissance, seules les saisies rétroactives (heure antérieure à l’accouchement) sont acceptées, sans déclencher d’alerte.', ln: 'Sima ya mbotama, kaka ba mesure ya kala (ngonga liboso ya mbotama) endimamaka, kozanga kobetisa alerte.' },
          },
          {
            id: 'dossier-accouchement', icone: 'fa-baby-carriage',
            titre: { fr: 'Le dossier d’accouchement (modules I à VI)', ln: 'Dossier ya mbotama (ba module I tii VI)' },
            acces: { fr: 'médecins et sages-femmes (antécédents médicaux : médecins).', ln: 'ba monganga mpe ba sage-femme (bokono ya kala : ba monganga).' },
            intro: {
              fr: 'Le dossier d’accouchement suit la femme de l’admission à la sortie, en six onglets.',
              ln: 'Dossier ya mbotama elandaka mwasi banda akoti tii abimi, na ba onglet motoba.',
            },
            points: [
              { fr: 'I · Admission : identité, groupe sanguin, gestité/parité, DDR/DPA et statut VIH repris du dossier CPN — vérifiez-les et complétez le reste (motif, provenance, personne à prévenir).', ln: 'I · Admission : identité, groupe sanguin, gestité/parité, DDR/DPA mpe statut VIH ezwami na dossier CPN — talá yango mpe tondisá oyo etikali (ntina, esika auti, moto ya koyebisa).' },
              { fr: 'II · Examen clinique : examen physique (poids, TA, pouls, conjonctives, œdèmes) et gynéco-obstétrical (HU, présentation, BCF, toucher vaginal, poche des eaux, bassin).', ln: 'II · Examen clinique : examen ya nzoto (kilo, TA, pouls, conjonctives, kovimba) mpe gynéco-obstétrical (HU, présentation, BCF, toucher vaginal, poche ya mai, bassin).' },
              { fr: 'IV · Accouchement : type (normal, césarienne avec indication…), heure, déchirure, épisiotomie, puis la délivrance (ocytocine 10 UI, traction contrôlée, massage utérin, placenta, pertes de sang).', ln: 'IV · Accouchement : lolenge (normal, césarienne na ntina…), ngonga, kopasuka, épisiotomie, sima délivrance (ocytocine 10 UI, traction contrôlée, massage ya libumu, placenta, makila ebungi).' },
              { fr: 'V · Nouveau-né : prénom, sexe, photo obligatoire, poids, taille, APGAR à 1 et 5 minutes, soins. Le carnet de vaccination de l’enfant est créé et la première séance programmée.', ln: 'V · Nouveau-né : prénom, sexe, foto esengeli, kilo, bolai, APGAR na miniti 1 mpe 5, bosalisi. Carnet ya mangwele ya mwana efungwamaka mpe séance ya liboso ebongisamaka.' },
              { fr: 'VI · Post-partum & sortie : planning de surveillance (créneaux de la 1re à la 6e heure, puis J1 à J3), traitements administrés, examen de sortie, mesures préventives, rendez-vous CPON, puis « Clôturer ».', ln: 'VI · Post-partum & sortie : planning ya bolandi (ngonga ya 1 tii 6, sima J1 tii J3), nkisi epesami, examen ya kobima, mesures préventives, rendez-vous CPON, sima « Clôturer ».' },
            ],
            captures: [
              { fichier: '10-admission', legende: { fr: 'I · Admission pré-remplie depuis le dossier CPN', ln: 'I · Admission ekomami déjà na dossier CPN' } },
              { fichier: '10-examen-clinique', legende: { fr: 'II · Examen clinique d’entrée', ln: 'II · Examen clinique ya kokota' } },
              { fichier: '10-accouchement', legende: { fr: 'IV · Accouchement et délivrance', ln: 'IV · Mbotama mpe délivrance' } },
              { fichier: '10-nouveau-ne', legende: { fr: 'V · Nouveau-né rattaché à la mère', ln: 'V · Mwana ya sika akangami na mama' } },
              { fichier: '10-post-partum', legende: { fr: 'VI · Planning de surveillance post-partum', ln: 'VI · Planning ya bolandi sima ya kobota' } },
            ],
            attention: { fr: 'La clôture est refusée tant qu’il manque l’examen de sortie ou une mesure préventive : la liste des éléments manquants s’affiche.', ln: 'Bakoki kokanga dossier te soki examen ya kobima to mesure préventive moko ezangi : liste ya makambo ezangi ekomonana.' },
          },
        ],
      },
      // ------------------------------------------------------------------ Enfants
      {
        titre: { fr: 'Enfants et vaccination', ln: 'Bana mpe mangwele' },
        icone: 'fa-baby',
        etapes: [
          {
            id: 'enfants', icone: 'fa-syringe',
            titre: { fr: 'Suivre la vaccination des enfants', ln: 'Kolanda mangwele ya bana' },
            intro: {
              fr: 'Les bébés nés en maternité ou enregistrés ensuite ont un carnet électronique selon le calendrier PEV de la RDC (vaccins, vitamine A, déparasitage).',
              ln: 'Babebe oyo babotami na maternité to bakomami sima bazali na carnet électronique na kolanda manaka ya PEV ya RDC (mangwele, vitamine A, nkisi ya ba vers).',
            },
            points: [
              { fr: '« Enfants & vaccination » liste les enfants suivis avec leur mère, leurs vaccins (ex. 10/23), la prochaine séance et le statut (À jour, En retard, Complets). Filtrez avec les onglets.', ln: '« Enfants & vaccination » elakisi bana balandami na mama na bango, mangwele na bango (ndakisa 10/23), séance oyo ezali koya mpe statut (À jour, En retard, Complets). Pona na ba onglet.' },
              { fr: 'Ouvrez le carnet : la prochaine séance et les doses à faire sont en haut. Cliquez sur « Enregistrer une séance » pour cocher les doses administrées (lot facultatif).', ln: 'Fungolá carnet : séance oyo ezali koya mpe mangwele ya kosala ezali na likoló. Finá « Enregistrer une séance » mpo na kococher mangwele epesami (lot soki ezali).' },
              { fr: 'Chaque dose faite indique la date et le soignant ; une saisie erronée s’annule avec un motif (elle reste visible).', ln: 'Mangwele nyonso esalemi elakisi mokolo mpe mosáli ; soki bakomi mabe, bakoki koboma yango na ntina (ekotikala komonana).' },
              { fr: 'Onglet « Croissance » : courbe de poids et visites de suivi (poids, taille, PC, PB, température, alimentation). Onglets « Naissance » et « Rendez-vous ».', ln: 'Onglet « Croissance » : courbe ya kilo mpe ba visite ya bolandi (kilo, bolai, PC, PB, température, bilei). Ba onglet « Naissance » mpe « Rendez-vous ».' },
            ],
            captures: [
              { fichier: '11-enfants', legende: { fr: 'Liste des enfants suivis', ln: 'Liste ya bana balandami' } },
              { fichier: '11-carnet-enfant', legende: { fr: 'Carnet de vaccination et prochaine séance', ln: 'Carnet ya mangwele mpe séance oyo ezali koya' } },
              { fichier: '11-carnet-croissance', legende: { fr: 'Courbe de croissance', ln: 'Courbe ya bokoli' } },
            ],
          },
          {
            id: 'enfant-ailleurs', icone: 'fa-child',
            titre: { fr: 'Enregistrer un enfant né ailleurs', ln: 'Kokoma mwana oyo abotamaki esika mosusu' },
            intro: {
              fr: 'Pour un enfant dont la mère n’a été suivie ni en CPN ni en accouchement sur la plateforme, créez son carnet depuis « Enregistrer un enfant né ailleurs ».',
              ln: 'Mpo na mwana oyo mama na ye alandamaki te na CPN to na mbotama na plateforme, fungolá carnet na ye na « Enregistrer un enfant né ailleurs ».',
            },
            points: [
              { fr: 'Mère : recherchez d’abord son dossier (nom, AC-PAT ou téléphone). S’il n’existe pas, choisissez « La mère n’a pas de dossier » pour la créer avec l’enfant.', ln: 'Mama : luká liboso dossier na ye (nkombo, AC-PAT to telefone). Soki ezali te, pona « La mère n’a pas de dossier » mpo na kofungola yango elongo na mwana.' },
              { fr: 'Enfant : photo (obligatoire), prénom, nom, sexe, date et lieu de naissance, mesures, et les doses déjà reçues ailleurs.', ln: 'Mwana : foto (esengeli), prénom, nkombo, sexe, mokolo mpe esika ya mbotama, ba mesure, mpe mangwele oyo azwaki esika mosusu.' },
              { fr: 'Le carnet PEV est calculé et la prochaine séance programmée automatiquement.', ln: 'Carnet PEV esalemaka mpe séance oyo elandi ebongisamaka yango moko.' },
            ],
            captures: [
              { fichier: '11-enregistrer-enfant', legende: { fr: 'Enregistrer un enfant pour la vaccination', ln: 'Kokoma mwana mpo na mangwele' } },
            ],
          },
        ],
      },
      // ------------------------------------------------------------------ Communication
      {
        titre: { fr: 'Communication', ln: 'Masolo' },
        icone: 'fa-comments',
        etapes: [
          {
            id: 'messages', icone: 'fa-comments',
            titre: { fr: 'Messages avec les patientes', ln: 'Nsango na bamama' },
            intro: {
              fr: 'Les patientes vous écrivent depuis leur application mobile. Les échanges sont chiffrés.',
              ln: 'Bamama bakomelaka yo na application na bango ya telefone. Masolo ebatelami (chiffrés).',
            },
            points: [
              { fr: 'Ouvrez « Messages » : chaque conversation affiche le dernier message, l’heure et le nombre de messages non lus.', ln: 'Fungolá « Messages » : lisolo moko na moko elakisi nsango ya suka, ngonga mpe motángo ya nsango oyo otángi te.' },
              { fr: 'Cliquez sur une patiente pour lire et répondre ; « Dossier » ouvre son dossier médical.', ln: 'Finá mama moko mpo na kotánga mpe koyanola ; « Dossier » efungolaka dossier na ye.' },
              { fr: '« Nouvelle conversation » pour écrire en premier à une patiente. Les messages rapides (icône éclair) insèrent des phrases types.', ln: '« Nouvelle conversation » mpo na kokomela mama liboso. Ba nsango ya mbangu (elembo ya kake) etiaka ba fraze oyo ebongisami.' },
            ],
            captures: [
              { fichier: '12-messages', legende: { fr: 'Liste des conversations', ln: 'Liste ya masolo' } },
              { fichier: '12-messages-conversation', legende: { fr: 'Conversation avec une patiente', ln: 'Lisolo na mama' } },
            ],
            attention: { fr: 'Ne partagez dans les messages que les informations utiles à la prise en charge.', ln: 'Kabolá na ba nsango kaka makambo oyo esengeli mpo na kosalisa mama.' },
          },
          {
            id: 'discussions', icone: 'fa-comment-medical',
            titre: { fr: 'Discussions entre collègues', ln: 'Masolo kati na baninga' },
            intro: {
              fr: '« Discussions » est la messagerie privée entre médecins, sages-femmes et infirmier·ères, en temps réel.',
              ln: '« Discussions » ezali nsango ya sekele kati na ba monganga, ba sage-femme mpe ba infirmier, na ntango wana.',
            },
            points: [
              { fr: 'Cliquez sur « Nouvelle discussion » et choisissez un collègue dans l’annuaire.', ln: 'Finá « Nouvelle discussion » mpe pona moninga na annuaire.' },
              { fr: 'Le point vert indique un collègue en ligne ; les coches indiquent que votre message est lu.', ln: 'Litono ya mobesu elakisi moninga azali en ligne ; ba coche elakisi ete atángi nsango na yo.' },
              { fr: '« Activer les notifications » vous prévient même quand l’onglet est en arrière-plan.', ln: '« Activer les notifications » eyebisaka yo ata soki onglet ezali na sima.' },
            ],
            captures: [
              { fichier: '13-discussions', legende: { fr: 'Les discussions avec les collègues', ln: 'Masolo na baninga' } },
              { fichier: '13-discussions-conversation', legende: { fr: 'Échange entre médecins', ln: 'Lisolo kati na ba monganga' } },
            ],
          },
          {
            id: 'groupe-pilotage', icone: 'fa-landmark',
            titre: { fr: 'Groupe de pilotage', ln: 'Groupe de pilotage' },
            acces: { fr: 'médecin chef seulement.', ln: 'médecin chef kaka.' },
            intro: {
              fr: 'Conversation commune à tous les médecins chefs et aux membres du comité de pilotage du projet. Les messages sont chiffrés.',
              ln: 'Lisolo ya bato nyonso : ba médecin chef nyonso mpe bato ya comité de pilotage ya mokano. Ba nsango ebatelami.',
            },
            points: [
              { fr: 'Écrivez votre message en bas et envoyez-le ; la liste des membres est à droite.', ln: 'Koma nsango na yo na nse mpe tinda yango ; liste ya bato ezali na loboko ya mobali.' },
              { fr: 'Utilisez ce groupe pour les rapports, les difficultés de terrain et les décisions du projet.', ln: 'Salelá groupe oyo mpo na ba rapport, mikakatano ya mosala mpe mikano ya mokano.' },
            ],
            captures: [
              { fichier: '14-groupe-pilotage', legende: { fr: 'Le groupe de pilotage', ln: 'Groupe de pilotage' } },
            ],
          },
          {
            id: 'conseils', icone: 'fa-newspaper',
            titre: { fr: 'Publier des conseils aux mamans', ln: 'Kotia toli mpo na bamama' },
            acces: { fr: 'médecins seulement.', ln: 'ba monganga kaka.' },
            intro: {
              fr: 'Les articles publiés ici apparaissent dans l’onglet « Conseils » de l’application des patientes.',
              ln: 'Ba article oyo bakotia awa ekomonana na onglet « Conseils » ya application ya bamama.',
            },
            points: [
              { fr: '« Publier un article » : saisissez un titre, le public visé (grossesse, après l’accouchement, toutes) et le conseil en termes simples.', ln: '« Publier un article » : koma titre, bato oyo article etali (zemi, sima ya kobota, nyonso) mpe toli na maloba ya pete.' },
              { fr: 'Ajoutez jusqu’à 4 photos ou une vidéo, puis « Publier ».', ln: 'Bakisá tii foto 4 to vidéo moko, sima « Publier ».' },
              { fr: '« Gérer les articles » : consultez, filtrez, supprimez vos articles ; le médecin chef approuve les articles en attente.', ln: '« Gérer les articles » : talá, pona, longola ba article na yo ; médecin chef andimaka ba article oyo ezali kozela.' },
            ],
            captures: [
              { fichier: '15-conseils', legende: { fr: 'Rédiger un article conseil', ln: 'Kokoma article ya toli' } },
              { fichier: '15-conseils-gerer', legende: { fr: 'Les articles publiés', ln: 'Ba article oyo etiami' } },
            ],
          },
        ],
      },
      // ------------------------------------------------------------------ Urgences
      {
        titre: { fr: 'Urgences et ambulances', ln: 'Makama mpe ba ambulance' },
        icone: 'fa-truck-medical',
        etapes: [
          {
            id: 'urgences', icone: 'fa-tower-broadcast',
            titre: { fr: 'Réguler une urgence', ln: 'Kobongisa likama ya nokinoki' },
            intro: {
              fr: 'Quand une patiente appuie sur « Urgence » dans son application, l’alerte arrive en direct avec sa position GPS et une alarme sonore.',
              ln: 'Ntango mama afini « Urgence » na application na ye, alerte ekómaka mbala moko na esika azali (GPS) mpe alarme.',
            },
            points: [
              { fr: 'Le bandeau rouge « Nouvelle alerte » indique la patiente, le motif et la gravité : cliquez sur « Prendre en charge ».', ln: 'Bandeau ya motane « Nouvelle alerte » elakisi mama, ntina mpe bozito : finá « Prendre en charge ».' },
              { fr: 'La carte montre la patiente, l’établissement et l’itinéraire (distance et durée estimées). « Voir » ouvre la fiche : motif, adresse estimée, téléphone.', ln: 'Carte elakisi mama, établissement mpe nzela (mosika mpe ntango). « Voir » efungolaka fiche : ntina, adresse, telefone.' },
              { fr: 'Choisissez un chauffeur, une ambulance disponible et, si besoin, un infirmier ou une sage-femme, puis « Envoyer ». La course est suivie en direct sur la carte.', ln: 'Pona chauffeur, ambulance oyo ezali libre mpe, soki esengeli, infirmier to sage-femme, sima « Envoyer ». Mobembo elandamaka na carte na ntango wana.' },
              { fr: 'Écrivez à la patiente dans la conversation de l’urgence ; la chronologie trace chaque étape. Signalez une « Fausse alerte » si nécessaire.', ln: 'Komela mama na lisolo ya likama ; chronologie ekomaka eteni nyonso. Yebisá « Fausse alerte » soki esengeli.' },
              { fr: '« Historique » liste toutes les urgences avec filtres (période, gravité, état), délais d’arrivée et export.', ln: '« Historique » elakisi makama nyonso na ba filtre (ntango, bozito, ndenge), ntango ya kokóma mpe export.' },
            ],
            captures: [
              { fichier: '16-urgences', legende: { fr: 'Nouvelle alerte et carte en direct', ln: 'Alerte ya sika mpe carte na ntango wana' } },
              { fichier: '16-urgences-detail', legende: { fr: 'Fiche de l’urgence : envoyer chauffeur et ambulance', ln: 'Fiche ya likama : kotinda chauffeur mpe ambulance' } },
              { fichier: '16-urgences-historique', legende: { fr: 'Historique des urgences', ln: 'Lisolo ya makama' } },
            ],
            attention: { fr: 'Une urgence est vitale : prenez-la en charge immédiatement, même si elle ne vous est pas adressée personnellement.', ln: 'Likama ezali likambo ya bomoi : simbá yango mbala moko, ata soki etindamelaki yo moko te.' },
          },
          {
            id: 'flotte', icone: 'fa-truck-medical',
            titre: { fr: 'Ambulances et chauffeurs', ln: 'Ba ambulance mpe ba chauffeur' },
            acces: { fr: 'médecins (gestion de la flotte).', ln: 'ba monganga (boyangeli ya ba motuka).' },
            intro: {
              fr: 'La flotte de l’établissement : ambulances, chauffeurs et leur disponibilité.',
              ln: 'Ba motuka ya établissement : ba ambulance, ba chauffeur mpe soki bazali libre.',
            },
            points: [
              { fr: '« Ajouter une ambulance » : immatriculation, modèle, type (A — transport, B — soins d’urgence), année. Changez son statut : disponible, atelier, hors service.', ln: '« Ajouter une ambulance » : plaque, modèle, lolenge (A — transport, B — soins d’urgence), mbula. Bongolá statut na yango : libre, atelier, hors service.' },
              { fr: 'Affectez un chauffeur à chaque ambulance ; une ambulance envoyée sur une urgence reste « En mission » jusqu’à la fin de la course.', ln: 'Pesá ambulance moko na moko chauffeur ; ambulance oyo etindami na likama etikalaka « En mission » tii mobembo esili.' },
              { fr: '« Ajouter un chauffeur » : identité, téléphone, permis, photo et mot de passe. Le chauffeur se connecte à l’application chauffeur avec son matricule.', ln: '« Ajouter un chauffeur » : identité, telefone, permis, foto mpe mot de passe. Chauffeur akotaka na application ya chauffeur na matricule na ye.' },
            ],
            captures: [
              { fichier: '16-ambulances', legende: { fr: 'Gestion des ambulances', ln: 'Boyangeli ya ba ambulance' } },
              { fichier: '16-chauffeurs', legende: { fr: 'Gestion des chauffeurs', ln: 'Boyangeli ya ba chauffeur' } },
            ],
          },
        ],
      },
      // ------------------------------------------------------------------ Santé publique
      {
        titre: { fr: 'Santé publique', ln: 'Bokolongono ya bato nyonso' },
        icone: 'fa-chart-area',
        etapes: [
          {
            id: 'relance', icone: 'fa-people-arrows',
            titre: { fr: 'Relance communautaire (RECO)', ln: 'Relance na lisanga (RECO)' },
            intro: {
              fr: 'Rendez-vous manqués, accouchements à clarifier, suivis postnatals et vaccinations en retard deviennent des tâches confiées au relais communautaire (RECO) du quartier.',
              ln: 'Ba rendez-vous oyo bazangaki, mbotama oyo esengeli kolimbola, bolandi sima ya kobota mpe mangwele na retard ekómaka misala oyo bapesaka relais communautaire (RECO) ya quartier.',
            },
            points: [
              { fr: '« Tableau de bord » : tâches ouvertes, en retard, sans RECO, personnes réintégrées et taux de contact, de visites et de réintégration.', ln: '« Tableau de bord » : misala efungwami, na retard, kozanga RECO, bato bazongi mpe taux ya kokutana, ya ba visite mpe ya kozonga.' },
              { fr: '« Tâches » et « Alertes » : suivez chaque dossier jusqu’à la confirmation de la prestation par la structure. « Lancer la détection » recherche les nouvelles situations.', ln: '« Tâches » mpe « Alertes » : landá dossier moko na moko tii structure endimi ete mosala esalemi. « Lancer la détection » elukaka makambo ya sika.' },
              { fr: '« RECO » : les relais de l’établissement, leurs zones et leur statut.', ln: '« RECO » : ba relais ya établissement, ba zone na bango mpe statut.' },
              { fr: '« Paramétrage » : les parcours (RAC, ARC, IRC, RPC, TCC) doivent être validés avant toute relance automatique.', ln: '« Paramétrage » : ba parcours (RAC, ARC, IRC, RPC, TCC) esengeli kondimama liboso relance ebanda yango moko.' },
            ],
            captures: [
              { fichier: '17-relance', legende: { fr: 'Tableau de bord de la relance', ln: 'Tableau de bord ya relance' } },
              { fichier: '17-relance-parametrage', legende: { fr: 'Paramétrage des parcours à valider', ln: 'Mibongiseli ya ba parcours ya kondima' } },
            ],
            attention: { fr: 'Les définitions et délais des parcours doivent être validés par le projet et les autorités sanitaires : sans validation, aucune relance n’est générée.', ln: 'Ndimbola mpe ntango ya ba parcours esengeli kondimama na mokano mpe bakonzi ya bokolongono : soki bandimi te, relance moko te ekosalema.' },
          },
          {
            id: 'epidemiologie', icone: 'fa-chart-area',
            titre: { fr: 'Module épidémiologie', ln: 'Module ya épidémiologie' },
            intro: {
              fr: 'Le module épidémiologie réunit dix sous-fenêtres pour planifier, surveiller et rendre compte, par territoire (pays, province, zone, aire de santé) et par année.',
              ln: 'Module ya épidémiologie esangisi ba fenêtre zomi mpo na kobongisa, kolanda mpe kopesa rapport, na kolanda esika (mboka, province, zone, aire de santé) mpe mbula.',
            },
            points: [
              { fr: 'A. Démographie et planification : référentiel démographique (populations de référence), paramètres et coefficients, calcul des populations cibles, planification.', ln: 'A. Démographie mpe planification : référentiel ya démographie (motángo ya bato), paramètres mpe coefficients, kotánga bato oyo etali, planification.' },
              { fr: 'B. Analyse : surveillance épidémiologique (événements, cas, investigations, courbe épidémique), morbidité et mortalité, couvertures sanitaires (CPN, accouchements, vaccination, zéro dose, abandons).', ln: 'B. Analyse : surveillance (makambo, ba cas, ba enquête, courbe épidémique), bokono mpe liwa, couvertures (CPN, mbotama, mangwele, zéro dose, kotika).' },
              { fr: 'C. Pilotage : alertes et insuffisances, rapports et exportation, historique, validation et traçabilité.', ln: 'C. Pilotage : ba alerte mpe ba mbeba, ba rapport mpe export, lisolo, kondima mpe traçabilité.' },
              { fr: 'Les couvertures ne se calculent qu’une fois une population cible validée pour le territoire et l’année : les données suivent un circuit de soumission et de validation.', ln: 'Ba couverture etángamaka kaka soki population cible endimami mpo na esika mpe mbula : ba données elandaka nzela ya kotinda mpe kondima.' },
            ],
            captures: [
              { fichier: '18-epidemiologie', legende: { fr: 'Tableau de bord épidémiologique', ln: 'Tableau de bord ya épidémiologie' } },
              { fichier: '18-epi-demographie', legende: { fr: 'Référentiel démographique', ln: 'Référentiel ya démographie' } },
              { fichier: '18-epi-surveillance', legende: { fr: 'Surveillance épidémiologique', ln: 'Surveillance ya épidémiologie' } },
              { fichier: '18-epi-couvertures', legende: { fr: 'Couvertures sanitaires', ln: 'Couvertures sanitaires' } },
            ],
          },
          {
            id: 'agents', icone: 'fa-user-nurse',
            titre: { fr: 'Agents de vaccination', ln: 'Basáli ya mangwele' },
            intro: {
              fr: 'Liste des vaccinateurs, superviseurs et relais communautaires, avec leur nombre de vaccinations du mois et leur statut.',
              ln: 'Liste ya ba vaccinateur, ba superviseur mpe ba relais communautaire, na motángo ya mangwele ya sanza mpe statut na bango.',
            },
            points: [
              { fr: 'Recherchez un agent par nom, matricule, e-mail ou téléphone ; filtrez par fonction.', ln: 'Luká mosáli na nkombo, matricule, e-mail to telefone ; pona na kolanda mosala.' },
              { fr: '« Ajouter un agent » crée son compte ; les icônes de la ligne permettent de modifier ou suspendre un compte.', ln: '« Ajouter un agent » efungolaka compte na ye ; bilembo ya molongo epesaka nzela ya kobongola to kotelemisa compte.' },
            ],
            captures: [
              { fichier: '24-agents', legende: { fr: 'Les agents de vaccination', ln: 'Basáli ya mangwele' } },
            ],
          },
        ],
      },
      // ------------------------------------------------------------------ Administration
      {
        titre: { fr: 'Hors connexion, sécurité et administration', ln: 'Kozanga Internet, libateli mpe boyangeli' },
        icone: 'fa-shield-halved',
        etapes: [
          {
            id: 'hors-connexion', icone: 'fa-arrows-rotate',
            titre: { fr: 'Travailler hors connexion et synchroniser', ln: 'Kosala kozanga Internet mpe kosangisa' },
            intro: {
              fr: 'Sans réseau, l’application continue de fonctionner : les saisies sont gardées sur l’appareil, chiffrées, puis envoyées automatiquement au retour de la connexion.',
              ln: 'Soki réseau ezali te, application ekobaka kosala : makambo okomi ebombamaka na appareil (chiffrés), sima etindamaka yango moko ntango Internet ezongi.',
            },
            points: [
              { fr: '« Synchronisation » montre l’état du serveur, de l’appareil (prêt ou non pour le hors connexion), la dernière synchronisation et la file d’attente.', ln: '« Synchronisation » elakisi ndenge serveur ezali, appareil (ezali prêt to te mpo na kosala kozanga Internet), synchronisation ya suka mpe file d’attente.' },
              { fr: 'Les dossiers actifs (patientes, salle de travail, carnets, établissements) sont copiés toutes les 30 minutes. « Synchroniser maintenant » force l’envoi.', ln: 'Ba dossier oyo ezali kosalema (bamama, salle ya kobota, ba carnet, ba établissement) ekopiamaka miniti 30 na 30. « Synchroniser maintenant » etindaka mbala moko.' },
              { fr: '« Dossiers hors connexion » : les patientes, enfants et admissions créés sans réseau restent consultables et complétables ; le serveur leur attribue un numéro à la synchronisation.', ln: '« Dossiers hors connexion » : bamama, bana mpe ba admission oyo bakomaki kozanga réseau bakoki kotalama mpe kotondisama ; serveur epesaka bango nimero na synchronisation.' },
              { fr: 'Une saisie n’est jamais enregistrée deux fois, même renvoyée plusieurs fois.', ln: 'Likambo moko ekomamaka mbala mibale te, ata soki etindami mbala ebele.' },
            ],
            captures: [
              { fichier: '20-synchronisation', legende: { fr: 'La page Synchronisation', ln: 'Lokasa ya Synchronisation' } },
              { fichier: '20-hors-ligne', legende: { fr: 'Dossiers créés hors connexion', ln: 'Ba dossier oyo ekomamaki kozanga Internet' } },
            ],
            attention: { fr: 'Au-delà de 7 jours sans contact avec le serveur, une connexion en ligne est exigée. Les saisies en attente restent sur l’appareil : ne videz pas le navigateur avant la synchronisation.', ln: 'Soki mikolo 7 eleki kozanga kokutana na serveur, esengeli kokota na Internet. Makambo ezali kozela etikalaka na appareil : kopangola navigateur te liboso ya synchronisation.' },
          },
          {
            id: 'audit', icone: 'fa-shield-halved',
            titre: { fr: 'Journal d’audit', ln: 'Journal d’audit' },
            intro: {
              fr: 'Le journal d’audit trace les ouvertures de dossiers, consultations, finalisations, addenda, rendez-vous et accès refusés. Il n’est ni modifiable ni supprimable et ne contient aucune donnée clinique.',
              ln: 'Journal d’audit ekomaka bofungoli ya ba dossier, ba consultation, ba finalisation, ba addendum, ba rendez-vous mpe ba nzela oyo epekisamaki. Ekoki kobongwana to kolongolama te mpe ezali na makambo ya bokono te.',
            },
            points: [
              { fr: 'Chaque ligne indique l’action, le dossier concerné, l’auteur (nom, rôle, matricule) et l’heure.', ln: 'Molongo moko na moko elakisi likambo, dossier, mokomi (nkombo, mosala, matricule) mpe ngonga.' },
              { fr: 'Filtrez « Tout » ou « Refus d’accès » pour repérer les tentatives non autorisées.', ln: 'Pona « Tout » to « Refus d’accès » mpo na komona bato oyo balingaki kokota kozanga ndingisa.' },
            ],
            captures: [
              { fichier: '21-audit', legende: { fr: 'Le journal d’audit', ln: 'Journal d’audit' } },
            ],
          },
          {
            id: 'soignants', icone: 'fa-user-doctor',
            titre: { fr: 'Gérer le personnel et l’établissement', ln: 'Koyangela basáli mpe établissement' },
            acces: { fr: 'médecin chef de service.', ln: 'médecin chef de service.' },
            intro: {
              fr: 'Le médecin chef crée les comptes des médecins, infirmier·ères et sages-femmes de son établissement. Les établissements eux-mêmes sont enregistrés par le comité de pilotage.',
              ln: 'Médecin chef afungolaka ba compte ya ba monganga, ba infirmier mpe ba sage-femme ya établissement na ye. Ba établissement yango moko ekomamaka na comité de pilotage.',
            },
            points: [
              { fr: '« Gestion soignant » : compteurs par profession, soignants en ligne, liste avec accès, dernière connexion et statut. Recherchez par nom, matricule, n° d’Ordre, e-mail ou spécialité.', ln: '« Gestion soignant » : ba compteur na kolanda mosala, basáli en ligne, liste na nzela ya kokota, mbala ya suka bakotaki mpe statut. Luká na nkombo, matricule, nimero ya Ordre, e-mail to spécialité.' },
              { fr: '« Ajouter un soignant » : identité, inscription à l’Ordre, rôle (médecin, infirmier·ère, sage-femme), établissement(s) et mot de passe initial. Le rôle définit ses droits.', ln: '« Ajouter un soignant » : identité, inscription na Ordre, mosala (monganga, infirmier, sage-femme), établissement(s) mpe mot de passe ya liboso. Mosala nde elakisi makoki na ye.' },
              { fr: 'Ouvrez un profil pour le modifier, le suspendre ou révoquer ses sessions sur tous ses appareils ; « Historique des ajouts » trace qui a créé quel compte.', ln: 'Fungolá profil mpo na kobongola, kotelemisa to koboma ba session na ye na ba appareil nyonso ; « Historique des ajouts » elakisi nani afungolaki compte nini.' },
              { fr: '« Établissements sanitaires » : fiche de l’établissement (code, localisation, responsable, services, lits, statut).', ln: '« Établissements sanitaires » : fiche ya établissement (code, esika, mokambi, ba service, ba mbeto, statut).' },
            ],
            captures: [
              { fichier: '22-soignants', legende: { fr: 'Médecins et infirmiers de l’établissement', ln: 'Ba monganga mpe ba infirmier ya établissement' } },
              { fichier: '22-etablissements', legende: { fr: 'Établissements sanitaires', ln: 'Ba établissement ya bokolongono' } },
            ],
            attention: { fr: 'Suspendez immédiatement le compte d’un soignant qui quitte l’établissement ou dont l’appareil est perdu.', ln: 'Telemisá mbala moko compte ya mosáli oyo atiki établissement to oyo appareil na ye ebungi.' },
          },
        ],
      },
    ],
    aide: {
      titre: { fr: 'Besoin d’aide ?', ln: 'Osengeli lisalisi ?' },
      texte: {
        fr: 'Pour un compte, un mot de passe ou un droit d’accès, adressez-vous à votre médecin chef. Pour un problème technique ou une suggestion, contactez l’équipe AMI Santé Connect.',
        ln: 'Mpo na compte, mot de passe to ndingisa ya kokota, kende epai ya médecin chef na yo. Mpo na likambo ya technique to likanisi, benga équipe ya AMI Santé Connect.',
      },
      bouton: { fr: 'Nous contacter', ln: 'Kokutana na biso' },
    },
  };
}
