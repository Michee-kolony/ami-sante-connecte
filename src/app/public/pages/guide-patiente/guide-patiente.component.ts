import { Component } from '@angular/core';
import { GuideVueComponent } from '../guides/guide-vue.component';
import { ConfigGuide } from '../guides/guide.model';

/**
 * Guide illustré de l'application mobile AMI Santé Connect, espace patiente (français / lingala).
 * Les captures proviennent de l'application réelle (compte de démonstration),
 * régénérées par un script puppeteer : voir public/images/guide-patiente/.
 */
@Component({
  selector: 'app-guide-patiente',
  standalone: true,
  imports: [GuideVueComponent],
  template: `<app-guide-vue [config]="config" />`,
})
export class GuidePatienteComponent {
  config: ConfigGuide = {
    url: '/guide-application-patiente',
    dossier: 'images/guide-patiente',
    format: 'telephone',
    captureHero: '03-accueil-1',
    titreOnglet: {
      fr: 'Comment utiliser l’application mobile AMI Santé Connect · Espace patiente',
      ln: 'Ndenge ya kosalela application AMI Santé Connect · Esika ya mama',
    },
    badgeIcone: 'fa-mobile-screen-button',
    badge: { fr: 'Application mobile · Espace patiente', ln: 'Application ya telefone · Esika ya mama' },
    titre: { fr: 'Comment utiliser l’application mobile', ln: 'Ndenge nini kosalela application ya telefone' },
    titreAccent: { fr: 'AMI Santé Connect', ln: 'AMI Santé Connect' },
    sousTitre: {
      fr: 'Guide pas à pas, illustré par des captures d’écran de l’application, pour les femmes suivies dans un centre de santé AMI Santé Connect : connexion, grossesse, rendez-vous, enfants, messages avec les soignants et appel d’urgence.',
      ln: 'Mokanda oyo elakisi eteni na eteni, na bililingi ya application, mpo na basi oyo balandamaka na centre de santé AMI Santé Connect : kokota, zemi, ba rendez-vous, bana, kotindela basáli ya bokolongono nsango mpe kobenga lisalisi ya nokinoki.',
    },
    boutons: [
      { fragment: 'connexion', icone: 'fa-play', libelle: { fr: 'Commencer le guide', ln: 'Kobanda mokanda' } },
      { fragment: 'urgence', icone: 'fa-truck-medical', secondaire: true, libelle: { fr: 'En cas d’urgence', ln: 'Soki likama ya nokinoki' } },
    ],
    avant: {
      titre: { fr: 'Avant de commencer', ln: 'Liboso ya kobanda' },
      cartes: [
        {
          icone: 'fa-download', couleur: 'brand',
          titre: { fr: '1. Installer l’application', ln: '1. Kotia application' },
          texte: {
            fr: 'Installez « AMI Santé Connect » sur votre téléphone Android ou iPhone, depuis le lien ou le magasin d’applications indiqué par votre centre de santé.',
            ln: 'Tiá « AMI Santé Connect » na telefone na yo (Android to iPhone), na nzela ya lien to ya magazini ya ba application oyo centre de santé na yo elakisi yo.',
          },
        },
        {
          icone: 'fa-key', couleur: 'accent',
          titre: { fr: '2. Recevoir vos identifiants', ln: '2. Kozwa bilembo na yo ya kokota' },
          texte: {
            fr: 'Lors de votre enregistrement au centre de santé, le soignant crée votre espace et vous remet votre identifiant et votre mot de passe.',
            ln: 'Ntango bakokoma yo na centre de santé, mosáli ya bokolongono akofungwela yo esika na yo mpe akopesa yo identifiant mpe mot de passe na yo.',
          },
        },
        {
          icone: 'fa-wifi', couleur: 'amber',
          titre: { fr: '3. Avoir une connexion', ln: '3. Kozala na Internet' },
          texte: {
            fr: 'Une connexion internet (données mobiles ou wifi) est nécessaire pour se connecter et recevoir les informations à jour.',
            ln: 'Osengeli kozala na Internet (mégas to wifi) mpo na kokota mpe kozwa nsango ya sika.',
          },
        },
      ],
    },
    reperes: {
      titre: { fr: 'La barre de navigation', ln: 'Barre ya kotambola' },
      texte: {
        fr: 'En bas de chaque écran, une barre d’icônes permet de passer d’une rubrique à l’autre. L’icône de la rubrique ouverte est entourée d’un cercle blanc.',
        ln: 'Na nse ya ecran nyonso, ezali na barre ya bilembo mpo na kokende na eteni mosusu. Elembo ya eteni oyo efungwami ezingami na cercle ya mpembe.',
      },
      items: [
        { icone: 'fa-house', libelle: { fr: 'Accueil', ln: 'Ebandeli' }, texte: { fr: 'Votre résumé : prochain rendez-vous, grossesse, enfants, centre de santé.', ln: 'Bokuse ya makambo na yo : rendez-vous oyo ezali koya, zemi, bana, centre de santé.' } },
        { icone: 'fa-calendar', libelle: { fr: 'Rendez-vous', ln: 'Ba rendez-vous' }, texte: { fr: 'Vos consultations et celles de vos enfants.', ln: 'Ba consultation na yo mpe ya bana na yo.' } },
        { icone: 'fa-comments', libelle: { fr: 'Messages', ln: 'Nsango' }, texte: { fr: 'Écrire en privé à vos soignants.', ln: 'Kokomela basáli ya bokolongono na yo na sekele.' } },
        { icone: 'fa-briefcase-medical', libelle: { fr: 'Urgence', ln: 'Likama' }, texte: { fr: 'Appeler une ambulance (bouton rouge).', ln: 'Kobenga ambulance (bouton ya motane).' }, urgence: true },
        { icone: 'fa-children', libelle: { fr: 'Mes enfants', ln: 'Bana na ngai' }, texte: { fr: 'Carnet de vaccination, croissance, naissance.', ln: 'Carnet ya mangwele, bokoli, mbotama.' } },
        { icone: 'fa-lightbulb', libelle: { fr: 'Conseils', ln: 'Toli' }, texte: { fr: 'Recommandations et articles de vos médecins.', ln: 'Toli mpe ba article ya ba monganga na yo.' } },
        { icone: 'fa-user', libelle: { fr: 'Profil', ln: 'Profil' }, texte: { fr: 'Vos informations, dossier CPN, carte, mot de passe.', ln: 'Bansango na yo, dossier CPN, carte, mot de passe.' } },
      ],
    },
    parties: [{
      titre: { fr: 'Application patiente', ln: 'Application ya mama' },
      icone: 'fa-mobile-screen-button',
      etapes: [
        {
          id: 'premier-lancement', icone: 'fa-mobile-screen-button',
          titre: { fr: 'Premier lancement', ln: 'Kofungola mbala ya liboso' },
          intro: { fr: 'À la première ouverture, l’application présente en trois écrans ce qu’elle vous permet de faire.', ln: 'Ntango okofungola yango mbala ya liboso, application elakisaka na ba ecran misato makambo oyo ekoki kosalela yo.' },
          points: [
            { fr: 'Faites défiler les écrans avec le doigt ou touchez la flèche bleue en bas à droite.', ln: 'Tambwisa ba ecran na mosapi to simba flèche ya bleu na nse, na loboko ya mobali.' },
            { fr: 'Touchez « Passer » pour aller directement à la connexion.', ln: 'Simba « Passer » mpo na kokende mbala moko na esika ya kokota.' },
            { fr: 'Sur le dernier écran, touchez « Commencer ». Cette présentation ne s’affiche plus ensuite.', ln: 'Na ecran ya suka, simba « Commencer ». Bilakiseli oyo ekozonga lisusu te.' },
          ],
          captures: [
            { fichier: '01-presentation-1', legende: { fr: 'Écran 1 : suivez votre grossesse', ln: 'Ecran 1 : landa zemi na yo' } },
            { fichier: '01-presentation-2', legende: { fr: 'Écran 2 : vos soignants à portée de main', ln: 'Ecran 2 : basáli ya bokolongono pene na yo' } },
            { fichier: '01-presentation-3', legende: { fr: 'Écran 3 : touchez « Commencer »', ln: 'Ecran 3 : simba « Commencer »' } },
          ],
        },
        {
          id: 'connexion', icone: 'fa-right-to-bracket',
          titre: { fr: 'Se connecter', ln: 'Kokota' },
          intro: { fr: 'Votre espace est créé par votre centre de santé lors de votre enregistrement. Il vous remet vos identifiants : il n’y a pas d’inscription à faire dans l’application.', ln: 'Centre de santé na yo nde efungolaka esika na yo ntango bakomi yo. Ekopesa yo bilembo ya kokota : osengeli komikoma yo moko na application te.' },
          points: [
            { fr: 'Dans le premier champ, saisissez au choix votre adresse e-mail, votre matricule (par exemple AC-PAT-000001) ou votre numéro de téléphone.', ln: 'Na esika ya liboso, koma e-mail na yo, matricule na yo (ndakisa AC-PAT-000001) to nimero ya telefone na yo.' },
            { fr: 'Saisissez votre mot de passe. L’icône en forme d’œil permet de l’afficher pour vérifier ce que vous avez tapé.', ln: 'Koma mot de passe na yo. Elembo ya liso ekolakisa yango mpo otala soki okomi malamu.' },
            { fr: 'Laissez « Se souvenir de moi » coché sur votre téléphone personnel pour rester connectée. Décochez-le sur un téléphone partagé.', ln: 'Tika « Se souvenir de moi » ecochée na telefone na yo moko mpo otikala kati. Longola yango soki telefone ezali ya bato mingi.' },
            { fr: 'Touchez « Se connecter ». Mot de passe oublié ? Touchez le lien prévu ou adressez-vous à votre centre de santé.', ln: 'Simba « Se connecter ». Obosani mot de passe ? Simba lien oyo ebongisami to kende na centre de santé na yo.' },
          ],
          captures: [
            { fichier: '02-connexion-vide', legende: { fr: 'L’écran de connexion', ln: 'Ecran ya kokota' } },
            { fichier: '02-connexion-remplie', legende: { fr: 'Identifiant et mot de passe saisis', ln: 'Identifiant mpe mot de passe ekomami' } },
          ],
          attention: { fr: 'Ne communiquez jamais votre mot de passe, même à un proche : il protège vos informations médicales.', ln: 'Kopesa mot de passe na yo na moto te, ata na moto ya libota : ebatelaka bansango na yo ya bokolongono.' },
        },
        {
          id: 'accueil', icone: 'fa-house',
          titre: { fr: 'L’écran d’accueil', ln: 'Ecran ya ebandeli' },
          intro: { fr: 'Après la connexion, l’accueil résume tout votre suivi en un coup d’œil.', ln: 'Sima ya kokota, ebandeli elakisi yo bolandi na yo mobimba na botali moko.' },
          points: [
            { fr: 'En haut : votre photo (accès au profil), le bouton clair/sombre et la cloche des rendez-vous.', ln: 'Likoló : foto na yo (mpo na kokende na profil), bouton ya mwinda/molili mpe ngonga ya ba rendez-vous.' },
            { fr: 'La carte « Prochain rendez-vous » indique la date, l’heure et le lieu. Un encadré rouge vous prévient si vous avez manqué un rendez-vous.', ln: 'Carte « Prochain rendez-vous » elakisi mokolo, ngonga mpe esika. Soki ozangaki rendez-vous, cadre ya motane ekoyebisa yo.' },
            { fr: 'Le bandeau rouge « Une urgence ? » ouvre l’appel d’ambulance.', ln: 'Bandeau ya motane « Une urgence ? » efungolaka libengi ya ambulance.' },
            { fr: 'Les boutons d’accès rapide (Ma grossesse, Rendez-vous, Mes enfants, Conseils, Accouchements, Mon profil) défilent horizontalement.', ln: 'Ba bouton ya nzela ya mbangu (Zemi na ngai, Ba rendez-vous, Bana na ngai, Toli, Mbotama, Profil na ngai) etambolaka na ngámbo.' },
            { fr: 'Plus bas : votre grossesse en cours, vos enfants et votre centre de santé (avec un bouton pour l’appeler).', ln: 'Na nse : zemi oyo ozali na yango, bana na yo mpe centre de santé na yo (na bouton mpo na kobenga yango).' },
            { fr: 'Tirez l’écran vers le bas pour actualiser les informations.', ln: 'Benda ecran na nse mpo na kozwa bansango ya sika.' },
          ],
          captures: [
            { fichier: '03-accueil-1', legende: { fr: 'Haut de l’accueil', ln: 'Likoló ya ebandeli' } },
            { fichier: '03-accueil-2', legende: { fr: 'Accès rapides et grossesse en cours', ln: 'Nzela ya mbangu mpe zemi oyo ezali' } },
            { fichier: '03-accueil-3', legende: { fr: 'Vos enfants et votre centre de santé', ln: 'Bana na yo mpe centre de santé na yo' } },
            { fichier: '12-accueil-sombre', legende: { fr: 'Le même écran en mode sombre', ln: 'Ecran moko na pole ya molili' } },
          ],
        },
        {
          id: 'grossesse', icone: 'fa-person-pregnant',
          titre: { fr: 'Ma grossesse', ln: 'Zemi na ngai' },
          intro: { fr: 'Cette page suit votre grossesse en cours, d’après les informations saisies par votre soignant.', ln: 'Lokasa oyo elandi zemi na yo, na kolanda bansango oyo mosáli ya bokolongono akomaki.' },
          points: [
            { fr: 'La carte du haut indique le numéro de la grossesse, l’âge de la grossesse en semaines (SA), la date des dernières règles (DDR) et la date prévue de l’accouchement (DPA).', ln: 'Carte ya likoló elakisi nimero ya zemi, bomoi ya zemi na ba poso (SA), mokolo ya sanza ya suka (DDR) mpe mokolo oyo bakanisi okobota (DPA).' },
            { fr: 'L’onglet « Fiches CPN » contient le compte rendu de chaque consultation prénatale. Touchez une fiche pour l’ouvrir.', ln: 'Onglet « Fiches CPN » ezali na lisolo ya botaleli moko na moko ya zemi. Simba fiche mpo na kofungola yango.' },
            { fr: 'L’onglet « Rendez-vous » liste les rendez-vous de suivi de cette grossesse.', ln: 'Onglet « Rendez-vous » elakisi ba rendez-vous nyonso ya bolandi ya zemi oyo.' },
          ],
          captures: [
            { fichier: '04-grossesse', legende: { fr: 'Grossesse en cours et fiches CPN', ln: 'Zemi oyo ezali mpe ba fiche CPN' } },
            { fichier: '04-grossesse-rdv', legende: { fr: 'Onglet « Rendez-vous »', ln: 'Onglet « Rendez-vous »' } },
          ],
        },
        {
          id: 'rendez-vous', icone: 'fa-calendar-check',
          titre: { fr: 'Mes rendez-vous', ln: 'Ba rendez-vous na ngai' },
          intro: { fr: 'Tous vos rendez-vous et ceux de vos enfants sont réunis ici.', ln: 'Ba rendez-vous na yo nyonso mpe ya bana na yo ezali awa.' },
          points: [
            { fr: '« À venir » : les prochains rendez-vous. « Historique » : les rendez-vous passés.', ln: '« À venir » : ba rendez-vous oyo ezali koya. « Historique » : ba rendez-vous oyo eleki.' },
            { fr: 'Une étiquette indique l’état : prévu, honoré ou « Raté ». En cas de rendez-vous manqué, contactez votre centre pour en fixer un autre.', ln: 'Étiquette elakisi ndenge ezali : ebongisami, oyaki to « Raté ». Soki ozangaki rendez-vous, benga centre na yo mpo bápesa yo mosusu.' },
            { fr: 'Touchez un rendez-vous pour afficher les consignes (par exemple : apporter le carnet de vaccination).', ln: 'Simba rendez-vous mpo na komona malako (ndakisa : yaka na carnet ya mangwele).' },
          ],
          captures: [
            { fichier: '05-rendez-vous', legende: { fr: 'Liste des rendez-vous', ln: 'Liste ya ba rendez-vous' } },
            { fichier: '05-rendez-vous-detail', legende: { fr: 'Consignes affichées en touchant un rendez-vous', ln: 'Malako emonani ntango osimbi rendez-vous' } },
            { fichier: '05-rendez-vous-historique', legende: { fr: 'Onglet « Historique »', ln: 'Onglet « Historique »' } },
          ],
        },
        {
          id: 'enfants', icone: 'fa-baby',
          titre: { fr: 'Mes enfants', ln: 'Bana na ngai' },
          intro: { fr: 'Chaque enfant né et enregistré au centre de santé a sa fiche : un véritable carnet de santé dans votre téléphone.', ln: 'Mwana nyonso oyo abotami mpe akomami na centre de santé azali na fiche na ye : carnet ya bokolongono na kati ya telefone na yo.' },
          points: [
            { fr: 'La liste affiche pour chaque enfant le nombre de vaccins faits, les vaccins en retard et la prochaine séance.', ln: 'Liste elakisi, mpo na mwana moko na moko, mangwele oyo asalaki, mangwele oyo ezali na retard mpe séance oyo ezali koya.' },
            { fr: 'Touchez un enfant pour ouvrir sa fiche : poids, taille et vaccins en haut, puis quatre onglets.', ln: 'Simba mwana mpo na kofungola fiche na ye : kilo, bolai mpe mangwele na likoló, sima ba onglet minei.' },
            { fr: '« Vaccins » : le calendrier vaccinal par âge (fait, à venir, en retard, hors délai).', ln: '« Vaccins » : manaka ya mangwele na kolanda mbula (esalemi, ezali koya, na retard, ntango eleki).' },
            { fr: '« Croissance » : les mesures de chaque visite (poids, taille, périmètres) et les conseils du soignant.', ln: '« Croissance » : bamesire ya botaleli nyonso (kilo, bolai, monene ya motó…) mpe toli ya mosáli ya bokolongono.' },
            { fr: '« Naissance » : les informations de l’accouchement et le score d’APGAR. « Rendez-vous » : les rendez-vous de l’enfant.', ln: '« Naissance » : bansango ya mbotama mpe score ya APGAR. « Rendez-vous » : ba rendez-vous ya mwana.' },
          ],
          captures: [
            { fichier: '06-enfants', legende: { fr: 'Liste de vos enfants', ln: 'Liste ya bana na yo' } },
            { fichier: '06-enfant-vaccins-1', legende: { fr: 'Fiche de l’enfant, onglet « Vaccins »', ln: 'Fiche ya mwana, onglet « Vaccins »' } },
            { fichier: '06-enfant-vaccins-2', legende: { fr: 'Calendrier vaccinal par âge', ln: 'Manaka ya mangwele na kolanda mbula' } },
            { fichier: '06-enfant-croissance', legende: { fr: 'Onglet « Croissance »', ln: 'Onglet « Croissance »' } },
            { fichier: '06-enfant-naissance', legende: { fr: 'Onglet « Naissance »', ln: 'Onglet « Naissance »' } },
            { fichier: '06-enfant-rendezvous', legende: { fr: 'Onglet « Rendez-vous »', ln: 'Onglet « Rendez-vous »' } },
          ],
        },
        {
          id: 'accouchements', icone: 'fa-heart-pulse',
          titre: { fr: 'Mes accouchements', ln: 'Mbotama na ngai' },
          intro: { fr: 'Retrouvez le déroulement de chaque accouchement à la maternité et le suivi après la naissance.', ln: 'Talá ndenge mbotama moko na moko elekaki na maternité mpe bolandi sima ya kobota.' },
          points: [
            { fr: 'Chaque carte indique la date, l’heure, le mode d’accouchement et le soignant qui vous a accouchée.', ln: 'Carte moko na moko elakisi mokolo, ngonga, ndenge obotaki mpe mosáli oyo abotisaki yo.' },
            { fr: 'Touchez le nom du bébé pour ouvrir sa fiche.', ln: 'Simba nkombo ya bebe mpo na kofungola fiche na ye.' },
            { fr: 'Touchez « Examen à l’arrivée » ou « Suivi du travail » pour afficher le détail des examens.', ln: 'Simba « Examen à l’arrivée » to « Suivi du travail » mpo na komona ba examen na bozindo.' },
          ],
          captures: [
            { fichier: '07-accouchements', legende: { fr: 'Résumé de l’accouchement', ln: 'Bokuse ya mbotama' } },
            { fichier: '07-accouchements-examen', legende: { fr: 'Détail de l’examen à l’arrivée', ln: 'Examen ya ntango okómaki, na bozindo' } },
          ],
        },
        {
          id: 'conseils', icone: 'fa-lightbulb',
          titre: { fr: 'Conseils', ln: 'Toli' },
          intro: { fr: 'Vos médecins publient ici des recommandations pour vous et des articles de prévention.', ln: 'Ba monganga na yo batiaka awa toli mpo na yo mpe ba article mpo na kobatela bokolongono.' },
          points: [
            { fr: '« Pour moi » : les conseils personnels que votre médecin vous a adressés.', ln: '« Pour moi » : toli oyo monganga na yo atindelaki yo moko.' },
            { fr: '« Articles » : les articles de santé, filtrables par thème (grossesse, après l’accouchement…).', ln: '« Articles » : ba article ya bokolongono, okoki kopona na kolanda likambo (zemi, sima ya kobota…).' },
            { fr: 'Touchez « Lire la suite » pour lire l’article en entier, touchez une photo pour l’agrandir.', ln: 'Simba « Lire la suite » mpo na kotanga article mobimba, simba foto mpo na komona yango monene.' },
            { fr: 'Vous pouvez aimer un article et laisser un commentaire.', ln: 'Okoki kolinga article mpe kotika maloba na yo.' },
          ],
          captures: [
            { fichier: '08-conseils', legende: { fr: 'Les articles de vos médecins', ln: 'Ba article ya ba monganga na yo' } },
            { fichier: '08-conseils-article', legende: { fr: 'Article ouvert avec « Lire la suite »', ln: 'Article efungwami na « Lire la suite »' } },
            { fichier: '08-conseils-pour-moi', legende: { fr: 'Onglet « Pour moi »', ln: 'Onglet « Pour moi »' } },
          ],
        },
        {
          id: 'messages', icone: 'fa-comments',
          titre: { fr: 'Messages', ln: 'Nsango' },
          intro: { fr: 'Échangez en privé avec vos soignants. Les conversations sont chiffrées.', ln: 'Solola na sekele na basáli ya bokolongono na yo. Masolo ebatelami (chiffrés).' },
          points: [
            { fr: 'La liste montre vos conversations avec le dernier message. Un point vert signale un soignant en ligne.', ln: 'Liste elakisi masolo na yo na nsango ya suka. Litono ya mobesu elakisi ete mosáli azali en ligne.' },
            { fr: 'Pour écrire à un nouveau soignant, touchez le bouton crayon en haut à droite, puis choisissez-le dans la liste.', ln: 'Mpo na kokomela mosáli mosusu, simba bouton ya crayon na likoló, loboko ya mobali, sima pona ye na liste.' },
            { fr: 'Touchez une conversation pour l’ouvrir, écrivez dans le champ en bas puis touchez la flèche pour envoyer.', ln: 'Simba lisolo mpo na kofungola yango, koma na esika ya nse sima simba flèche mpo na kotinda.' },
            { fr: 'Les deux coches indiquent que votre message a été lu.', ln: 'Ba coche mibale elakisi ete batángi nsango na yo.' },
          ],
          captures: [
            { fichier: '09-messages', legende: { fr: 'Vos conversations', ln: 'Masolo na yo' } },
            { fichier: '09-messages-nouveau', legende: { fr: 'Choisir un soignant pour un nouveau message', ln: 'Kopona mosáli mpo na nsango ya sika' } },
            { fichier: '09-messages-conversation', legende: { fr: 'Une conversation avec votre médecin', ln: 'Lisolo na monganga na yo' } },
          ],
          attention: { fr: 'La messagerie n’est pas faite pour les urgences : votre soignant peut ne pas répondre tout de suite. En cas d’urgence, utilisez le bouton Urgence.', ln: 'Nsango esalemaki mpo na makama ya nokinoki te : mosáli akoki koyanola mbala moko te. Soki likama, salelá bouton Urgence.' },
        },
        {
          id: 'urgence', icone: 'fa-truck-medical',
          titre: { fr: 'Urgence : appeler une ambulance', ln: 'Likama : kobenga ambulance' },
          intro: { fr: 'En cas d’urgence, l’application envoie votre alerte et votre position à la régulation, qui vous envoie l’ambulance disponible la plus proche.', ln: 'Soki likama, application etindaka libengi na yo mpe esika ozali na régulation, oyo ekotindela yo ambulance oyo ezali pene mpe ezali libre.' },
          points: [
            { fr: 'Ouvrez l’urgence depuis le bandeau rouge de l’accueil ou le bouton rouge de la barre du bas.', ln: 'Fungolá urgence na bandeau ya motane ya ebandeli to na bouton ya motane ya barre ya nse.' },
            { fr: 'Autorisez la localisation si le téléphone le demande : la carte vous situe et affiche les ambulances proches.', ln: 'Pesá ndingisa ya localisation soki telefone esengi : carte ekolakisa esika ozali mpe ba ambulance oyo ezali pene.' },
            { fr: 'Touchez « Appeler une ambulance », puis choisissez ce qui se passe (douleurs, saignements, perte des eaux…). L’alerte part immédiatement.', ln: 'Simba « Appeler une ambulance », sima pona likambo ezali kosalema (mpasi, makila, mai ebimi…). Libengi ekei mbala moko.' },
            { fr: 'Vous suivez ensuite l’ambulance sur la carte, avec le temps d’arrivée estimé, et vous pouvez écrire ou téléphoner au chauffeur.', ln: 'Sima okolanda ambulance na carte, na ntango oyo ekoki kokóma, mpe okoki kokomela to kobenga chauffeur.' },
            { fr: '« Annuler » ferme le choix sans rien envoyer. « Appeler mon centre de santé » lance un appel téléphonique.', ln: '« Annuler » ekangi kopona kozanga kotinda eloko. « Appeler mon centre de santé » ebengaka na telefone.' },
          ],
          captures: [
            { fichier: '10-urgence-carte', legende: { fr: 'Carte et bouton « Appeler une ambulance »', ln: 'Carte mpe bouton « Appeler une ambulance »' } },
            { fichier: '10-urgence-carte-motif', legende: { fr: 'Choisir ce qui se passe', ln: 'Kopona likambo ezali kosalema' } },
          ],
          attention: { fr: 'N’utilisez ce bouton qu’en cas de véritable urgence : une ambulance est réellement envoyée.', ln: 'Salelá bouton oyo kaka soki likama ya solo : ambulance etindamaka mpenza.' },
        },
        {
          id: 'profil', icone: 'fa-id-card',
          titre: { fr: 'Mon profil', ln: 'Profil na ngai' },
          intro: { fr: 'Votre profil regroupe vos informations, votre dossier médical, votre carte patiente et vos réglages.', ln: 'Profil na yo esangisi bansango na yo, dossier na yo ya bokolongono, carte na yo ya mama mpe mibongiseli na yo.' },
          points: [
            { fr: '« Mes informations » : âge, e-mail et téléphone enregistrés par votre centre.', ln: '« Mes informations » : mbula, e-mail mpe telefone oyo centre na yo ekomaki.' },
            { fr: '« Mon enregistrement CPN » : votre dossier (antécédents, groupe sanguin, identité…). Il est confidentiel : saisissez à nouveau votre mot de passe et touchez « Afficher ».', ln: '« Mon enregistrement CPN » : dossier na yo (makambo ya kala, groupe sanguin, identité…). Ezali sekele : koma lisusu mot de passe na yo mpe simba « Afficher ».' },
            { fr: '« Voir ma carte » affiche votre carte patiente (recto-verso, avec QR code). « Télécharger / imprimer ma carte » en fait un PDF à imprimer ou partager.', ln: '« Voir ma carte » elakisi carte na yo (ngámbo mibale, na QR code). « Télécharger / imprimer ma carte » ekómisi yango PDF mpo na kobimisa to kokabola.' },
            { fr: '« Apparence » : mode clair, sombre ou automatique.', ln: '« Apparence » : pole ya mwinda, ya molili to automatique.' },
            { fr: '« Changer mon mot de passe » : saisissez l’actuel puis deux fois le nouveau.', ln: '« Changer mon mot de passe » : koma oyo ya sikoyo, sima oyo ya sika mbala mibale.' },
            { fr: '« Se déconnecter » ferme votre session, à faire sur un téléphone partagé.', ln: '« Se déconnecter » ekangi session na yo ; salá yango soki telefone ezali ya bato mingi.' },
          ],
          captures: [
            { fichier: '11-profil-1', legende: { fr: 'Haut du profil', ln: 'Likoló ya profil' } },
            { fichier: '11-profil-dossier-verrouille', legende: { fr: 'Dossier CPN : mot de passe demandé', ln: 'Dossier CPN : basengi mot de passe' } },
            { fichier: '11-profil-dossier-1', legende: { fr: 'Dossier CPN : antécédents', ln: 'Dossier CPN : makambo ya kala' } },
            { fichier: '11-profil-dossier-2', legende: { fr: 'Dossier CPN : profil biologique et identité', ln: 'Dossier CPN : profil biologique mpe identité' } },
            { fichier: '11-profil-carte', legende: { fr: 'Votre carte patiente', ln: 'Carte na yo ya mama' } },
            { fichier: '11-profil-2', legende: { fr: 'Centre de santé, apparence et sécurité', ln: 'Centre de santé, apparence mpe libateli' } },
            { fichier: '11-profil-mot-de-passe', legende: { fr: 'Changer son mot de passe', ln: 'Kobongola mot de passe' } },
          ],
        },
      ],
    }],
    aide: {
      titre: { fr: 'Besoin d’aide ?', ln: 'Osengeli lisalisi ?' },
      texte: { fr: 'Votre centre de santé peut vous aider à installer l’application, retrouver votre mot de passe ou corriger une information de votre dossier.', ln: 'Centre de santé na yo ekoki kosalisa yo kotia application, kozwa lisusu mot de passe na yo to kobongisa nsango moko na dossier na yo.' },
      bouton: { fr: 'Nous contacter', ln: 'Kokutana na biso' },
    },
  };
}
