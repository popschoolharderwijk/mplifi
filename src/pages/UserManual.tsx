import { LuShieldCheck } from 'react-icons/lu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { NAV_ICONS, NAV_LABELS } from '@/config/nav-labels';

interface ManualSection {
	icon: React.ElementType;
	title: string;
	description: string;
	details: string[];
}

const sections: ManualSection[] = [
	{
		icon: NAV_ICONS.dashboard,
		title: NAV_LABELS.dashboard,
		description: 'Het dashboard biedt een overzicht van de belangrijkste gegevens en actiepunten.',
		details: [
			'Statistieken: aantal actieve leerlingen, docenten en overeenkomsten in één oogopslag.',
			'Actiepunten: openstaande taken die aandacht vereisen, zoals ontbrekende beschikbaarheid of verlopen overeenkomsten.',
			'Recente leerlingen: de laatst toegevoegde of gewijzigde leerlingen.',
			'Docent beschikbaarheid: snel zien welke docenten vandaag beschikbaar zijn.',
		],
	},
	{
		icon: NAV_ICONS.users,
		title: NAV_LABELS.users,
		description: 'Beheer alle gebruikers van het systeem: medewerkers, docenten en leerlingen.',
		details: [
			'Gebruikers aanmaken: voeg nieuwe gebruikers toe met e-mailadres, naam en telefoonnummer.',
			'Rollen toewijzen: geef gebruikers een rol (Site Admin, Admin, Staff). Rollen bepalen welke menu-items en functies zichtbaar zijn.',
			'Zoeken en filteren: doorzoek de gebruikerslijst op naam of e-mail, filter op rol.',
			'Gebruiker verwijderen: verwijder een gebruiker inclusief alle gekoppelde data (docent- en leerlingprofiel).',
		],
	},
	{
		icon: NAV_ICONS.lessonTypes,
		title: NAV_LABELS.lessonTypes,
		description: 'Definieer de soorten lessen die de muziekschool aanbiedt.',
		details: [
			'Lessoort aanmaken: geef een naam, kleur, icoon en optionele beschrijving op.',
			'Groepsles: markeer een lessoort als groepsles om aan te geven dat meerdere leerlingen tegelijk deelnemen.',
			'Opties: stel per lessoort de beschikbare frequenties, duur (in minuten) en prijs per les in.',
			'Kostenplaats: koppel optioneel een kostenplaats voor de boekhouding.',
			'Actief/inactief: deactiveer een lessoort zodat deze niet meer gekozen kan worden voor nieuwe overeenkomsten.',
		],
	},
	{
		icon: NAV_ICONS.teachers,
		title: NAV_LABELS.teachers,
		description: 'Beheer het docentenbestand en hun beschikbaarheid.',
		details: [
			'Docenten overzicht: bekijk alle docenten met hun lessoorten en status (actief/inactief).',
			'Docent toevoegen: koppel een bestaande gebruiker als docent of maak direct een nieuwe gebruiker aan.',
			'Lessoorten toewijzen: geef per docent aan welke lessoorten hij/zij kan geven.',
			'Beschikbaarheid: stel per docent in op welke dagen en tijden zij beschikbaar zijn.',
			'Agenda: bekijk de planning van een docent met alle ingeplande lessen, inclusief afwijkingen en annuleringen.',
		],
	},
	{
		icon: NAV_ICONS.students,
		title: NAV_LABELS.students,
		description: 'Beheer leerlinggegevens en bekijk hun lesovereenkomsten.',
		details: [
			'Leerlingen overzicht: doorzoek en filter leerlingen op naam, lessoort of status.',
			'Leerling toevoegen: maak een nieuwe leerling aan (een leerlingprofiel wordt automatisch aangemaakt zodra een overeenkomst wordt afgesloten).',
			'Gegevens bewerken: pas contactgegevens, geboortedatum, ouder/verzorger-informatie en debiteurgegevens aan.',
			'Lesgeschiedenis: bekijk alle actieve en beëindigde lesovereenkomsten van een leerling.',
		],
	},
	{
		icon: NAV_ICONS.agreements,
		title: NAV_LABELS.agreements,
		description: 'Lesovereenkomsten vastleggen en beheren via de overeenkomsten-wizard.',
		details: [
			'Nieuwe overeenkomst: doorloop de wizard met vier stappen — leerling kiezen, lessoort en docent selecteren, dag/tijd/frequentie instellen en bevestigen.',
			'Stap 1 – Leerling: kies een bestaande gebruiker of voeg direct een nieuwe toe.',
			'Stap 2 – Docent & lessoort: selecteer de lessoort en kies uit docenten die deze lessoort geven en op de gekozen dag beschikbaar zijn.',
			'Stap 3 – Planning: kies de dag van de week, starttijd, frequentie (wekelijks, tweewekelijks, maandelijks), duur en startdatum.',
			'Stap 4 – Bevestiging: controleer alle gegevens en bevestig de overeenkomst.',
			'Bewerken: open een bestaande overeenkomst om wijzigingen door te voeren.',
			'Beëindigen: stel een einddatum in om een overeenkomst te stoppen.',
		],
	},
	{
		icon: NAV_ICONS.projects,
		title: NAV_LABELS.projects,
		description: 'Beheer projecten en plan tijdsloten voor docenten en leerlingen.',
		details: [
			'Projecten overzicht: bekijk alle projecten met domein, label, eigenaar en status (actief/inactief).',
			'Project aanmaken: geef een naam op, kies een label (gekoppeld aan een domein), wijs een eigenaar toe en stel optioneel een kostenplaats in.',
			'Domeinen en labels: organiseer projecten via een hiërarchie van domeinen en labels, beheerd via Instellingen.',
			'Tijdslot plannen: plan vanuit de projectpagina of de agenda een tijdslot voor een project, gekoppeld aan één of meer docenten en leerlingen.',
			'Deactiveren: zet een project op inactief zodat er geen nieuwe tijdsloten meer voor gepland kunnen worden.',
		],
	},
	{
		icon: NAV_ICONS.agenda,
		title: 'Agenda & afwijkingen',
		description: 'De agenda toont alle ingeplande lessen en projecten op basis van overeenkomsten en planning.',
		details: [
			'Agenda weergave: bekijk de planning per week of maand voor een docent.',
			'Handmatige events: maak losse afspraken aan met titel, beschrijving, kleur en deelnemers.',
			'Projectplanning: plan tijdsloten voor projecten met meerdere docenten en leerlingen als deelnemers.',
			'Les verplaatsen: maak een afwijking aan om een les eenmalig of structureel te verplaatsen naar een andere dag/tijd.',
			'Les annuleren: annuleer een enkele les of alle toekomstige lessen in een reeks.',
			'Herhaling: afwijkingen kunnen eenmalig of herhalend zijn, met een optionele einddatum.',
		],
	},
	{
		icon: NAV_ICONS.reports,
		title: NAV_LABELS.reports,
		description: 'Rapportages over lesuren, projecturen, leeftijdscategorieën en BTW.',
		details: [
			'Periode selecteren: kies een vooraf ingestelde periode (deze maand, vorig kwartaal, etc.) of stel handmatig een start- en einddatum in.',
			'Docentenfilter: filter de rapportage op een specifieke docent (alleen zichtbaar voor beheerders).',
			'Samenvatting: bekijk het totaal aantal uren, opgesplitst naar leerlingen onder 18 (BTW-vrij) en 18+ (BTW-plichtig).',
			'Detail per lessoort: zie per lessoort het aantal leerlingen, totaal uren en de verdeling per leeftijdscategorie.',
			'Projecturen: bekijk per docent per project het aantal geplande uren binnen de geselecteerde periode.',
		],
	},
	{
		icon: LuShieldCheck,
		title: 'Rollen & rechten',
		description: 'Het systeem kent verschillende rollen die bepalen wat een gebruiker kan zien en doen.',
		details: [
			'Site Admin: volledige toegang tot alle functies, inclusief gebruikersbeheer en systeeminstellingen.',
			'Admin: toegang tot alle beheersfuncties (gebruikers, lessoorten, docenten, leerlingen, overeenkomsten, rapportages).',
			'Staff (medewerker): kan leerlingen en docenten bekijken en rapportages inzien, maar kan geen systeeminstellingen wijzigen.',
			'Docent: ziet alleen eigen profiel, beschikbaarheid, leerlingen en statistieken.',
			'Leerling: ziet alleen eigen profiel en gekoppelde docent(en).',
		],
	},
];

export default function UserManual() {
	return (
		<div className="space-y-6">
			<PageHeader
				title={NAV_LABELS.manual}
				subtitle="Functionele beschrijving van alle onderdelen van POPschool"
			/>

			{/* Sections */}
			<div className="grid gap-6">
				{sections.map((section) => (
					<Card key={section.title}>
						<CardHeader className="pb-3">
							<CardTitle className="flex items-center gap-2 text-lg">
								<section.icon className="h-5 w-5 text-primary" />
								{section.title}
							</CardTitle>
							<p className="text-sm text-muted-foreground">{section.description}</p>
						</CardHeader>
						<CardContent>
							<ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
								{section.details.map((detail) => (
									<li key={detail}>{detail}</li>
								))}
							</ul>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
