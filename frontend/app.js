// FinTrack — app.js (Connected to Flask Backend)

function getFinTrackApiBase() {
    const configuredBase =
        window.FINTRACK_API_BASE ||
        document.querySelector('meta[name="fintrack-api-base"]')?.content ||
        "";

    if (configuredBase.trim()) {
        const cleanBase = configuredBase.trim().replace(/\/+$/, "");
        return cleanBase.endsWith("/api") ? cleanBase : `${cleanBase}/api`;
    }

    const isLocalFrontend =
        window.location.protocol === "file:" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "localhost";

    return isLocalFrontend ? "http://127.0.0.1:5001/api" : "/api";
}

function getFinTrackDemoMode() {
    const configuredValue =
        window.FINTRACK_SHOW_DEMO_DATA ||
        document.querySelector('meta[name="fintrack-show-demo-data"]')?.content ||
        "";

    return String(configuredValue).trim().toLowerCase() === "true";
}

const API = getFinTrackApiBase();
const AUTH_API = API.replace(/\/api\/?$/, "/auth");
const SHOW_DEMO_DATA = getFinTrackDemoMode();
const nativeFetch = window.fetch.bind(window);

// ══════════════════════════════════════
//  i18n
// ══════════════════════════════════════
const SUPPORTED_LANGS = ["en", "fr", "es"];
let CURRENT_LANG = "en";
let CURRENT_CURRENCY = sanitizeCurrencyCode(localStorage.getItem("fintrack-currency") || "USD") || "USD";

const TRANSLATIONS = {
    en: {},

    fr: {
        // Sidebar
        "sidebar.overview": "VUE D'ENSEMBLE",
        "sidebar.home": "Accueil",
        "sidebar.transactions": "Transactions",
        "sidebar.budgets": "Budgets",
        "sidebar.goals": "Objectifs",
        "sidebar.investments": "Investissements",
        "sidebar.recurring": "Paiements récurrents",
        "sidebar.coach": "Coach Financier",
        "sidebar.settings": "Paramètres",
        "auth.logout": "Déconnexion",

        // User plan
        "plan.premium": "Plan Premium",
        "plan.trial": "Essai gratuit",

        // Trial countdown banner
        "trial.banner.cta": "S'abonner",
        "trial.banner.days_left": "Il vous reste {n} jours d'essai gratuit.",
        "trial.banner.urgent": "Plus que {n} jours d'essai — abonnez-vous pour conserver vos données.",
        "trial.banner.last_day": "Dernier jour d'essai gratuit — abonnez-vous pour garder l'accès.",
        "trial.banner.expired": "Votre essai est terminé — abonnez-vous pour conserver vos données.",

        // Topnav
        "topnav.search": "Rechercher des transactions…",
        "topnav.toggle_theme": "Changer de thème",
        "topnav.add_new": "Ajouter",
        "topnav.add_recurring": "Ajouter un paiement",
        "topnav.add_goal": "Ajouter un objectif",
        "topnav.add_investment": "Ajouter un investissement",

        // Page meta
        "page.dashboard.title": "Accueil",
        "page.dashboard.sub": "Votre aperçu financier en un coup d'œil.",
        "page.transactions.title": "Transactions",
        "page.transactions.sub": "Visualisez l'origine et la destination de votre argent.",
        "page.budgets.title": "Budgets",
        "page.budgets.sub": "Suivez vos budgets hebdomadaires, mensuels et personnalisés.",
        "page.goals.title": "Objectifs",
        "page.goals.sub": "Suivez vos progrès d'épargne et vos projets futurs.",
        "page.investments.title": "Investissements",
        "page.investments.sub": "Surveillez la performance de vos investissements.",
        "page.recurring.title": "Paiements récurrents",
        "page.recurring.sub": "Gérez vos factures, abonnements et revenus récurrents.",
        "page.categories.title": "Coach Financier",
        "page.categories.sub": "Posez vos questions et obtenez des conseils basés sur vos données FinTrack.",
        "page.settings.title": "Paramètres",
        "page.settings.sub": "Personnalisez votre expérience FinTrack.",

        // Settings — Profile
        "settings.section.profile": "Profil",
        "settings.profile.desc": "Gérez vos informations personnelles",
        "settings.avatar.upload": "Téléverser une photo de profil",
        "settings.first_name": "Prénom",
        "settings.last_name": "Nom",
        "settings.email": "E-mail",
        "settings.phone": "Téléphone",
        "settings.save_changes": "Enregistrer les modifications",

        // Settings — Preferences
        "settings.section.preferences": "Préférences",
        "settings.preferences.desc": "Personnalisez votre expérience",
        "settings.currency": "Devise",
        "settings.language": "Langue",
        "settings.date_format": "Format de date",
        "settings.first_day": "Premier jour de la semaine",
        "settings.save_preferences": "Enregistrer les préférences",
        "day.sunday": "Dimanche",
        "day.monday": "Lundi",

        // Settings — Security
        "settings.section.security": "Sécurité",
        "settings.security.desc": "Gérez les paramètres de sécurité de votre compte",
        "settings.2fa": "Authentification à deux facteurs",
        "settings.2fa.desc": "Ajoutez une couche de sécurité supplémentaire à votre compte",
        "settings.enable": "Activer",
        "settings.change_password": "Changer le mot de passe",
        "settings.change_password.desc": "Mettez à jour votre mot de passe régulièrement pour plus de sécurité",
        "settings.change": "Modifier",
        "settings.billing.title": "Facturation",
        "settings.billing.desc": "Gérez votre abonnement FinTrack Pro.",
        "settings.billing.pro": "FinTrack Pro",
        "settings.billing.status_trial": "Essai de 14 jours, puis 4,99 $ US/mois ou 6,99 $ CA/mois.",
        "settings.billing.status_active": "Votre abonnement FinTrack Pro est actif.",
        "settings.billing.status_expired": "Votre essai est terminé. Abonnez-vous pour continuer.",
        "settings.billing.subscribe": "S'abonner",
        "settings.billing.cancel": "Annuler l'abonnement",
        "settings.billing.manage": "Gérer l'abonnement",
        "settings.billing.portal_hint": "Mettez à jour votre carte ou consultez vos factures depuis le portail sécurisé de Stripe.",
        "settings.billing.portal_error": "Impossible d'ouvrir le portail de facturation",
        "settings.billing.redirecting": "Redirection…",
        "settings.billing.canceling": "Annulation…",
        "settings.billing.error": "Impossible de démarrer le paiement",
        "settings.billing.cancel_error": "Impossible d'annuler l'abonnement",
        "settings.billing.cancel_success": "Annulation de l'abonnement programmée.",
        "settings.billing.status_cancel_scheduled": "Votre abonnement est programmé pour être annulé le {date}. Vous gardez FinTrack Pro jusque-là.",
        "settings.billing.status_trial_stripe": "Votre essai Stripe est actif. Annulez avant le {date} pour éviter le premier paiement.",
        "settings.billing.status_trial_stripe_no_date": "Votre essai Stripe est actif. Vous pouvez annuler avant la fin de l'essai.",
        "settings.billing.status_past_due": "Le paiement nécessite votre attention. Gérez votre abonnement pour conserver l'accès.",
        "settings.billing.period_unknown": "Fin de la période de facturation",

        // Settings — Your data (export)
        "settings.section.data": "Vos données",
        "settings.data.desc": "Téléchargez tout ce que vous avez stocké dans FinTrack sous forme d'archive ZIP de fichiers CSV.",
        "settings.data.export": "Exporter vos données",
        "settings.data.export_desc": "Transactions, budgets, objectifs, paiements récurrents et historique du Coach Financier — le tout dans une archive téléchargeable.",
        "settings.data.download": "Télécharger .zip",
        "settings.data.preparing": "Préparation…",
        "settings.data.downloaded": "Votre téléchargement a démarré.",
        "settings.data.error": "Impossible de préparer l'export. Veuillez réessayer.",

        "settings.billing.cancel_modal.title": "Annuler FinTrack Pro ?",
        "settings.billing.cancel_modal.desc": "Votre abonnement restera actif jusqu'à la fin de la période de facturation en cours. Vous pourrez continuer à utiliser FinTrack Pro jusque-là.",
        "settings.billing.cancel_modal.period_label": "Accès jusqu'au",
        "settings.billing.cancel_modal.no_renewal": "Aucun renouvellement mensuel ne sera facturé après cette date.",
        "settings.billing.cancel_modal.keep": "Garder l'abonnement",
        "settings.billing.cancel_modal.confirm": "Confirmer l'annulation",

        // Toasts
        "toast.profile_updated": "Profil mis à jour",
        "toast.profile_error": "Impossible d'enregistrer les modifications",
        "toast.preferences_saved": "Préférences enregistrées",
        "toast.preferences_error": "Impossible d'enregistrer les préférences",
        "toast.saving": "Enregistrement…",

        // Country picker
        "phone.country_placeholder": "Pays",
        "currency.placeholder": "Choisir une devise",

        // Dashboard — stat cards
        "dashboard.total_balance": "Solde total",
        "dashboard.monthly_income": "Revenus du mois",
        "dashboard.monthly_expenses": "Dépenses du mois",
        "dashboard.total_savings": "Épargne totale",

        // Dashboard — Quick Actions
        "dashboard.quick_actions": "Actions rapides",
        "dashboard.transfer": "Virement",
        "dashboard.deposit": "Dépôt",
        "dashboard.withdraw": "Retrait",
        "dashboard.pay_bills": "Payer une facture",
        "dashboard.recurring": "Récurrents",
        "dashboard.calculator": "Calculatrice",
        "dashboard.import_csv": "Importer un CSV",
        "dashboard.daily_insights": "Insights quotidiens",
        "dashboard.daily_insights_scanning": "Analyse de vos 90 derniers jours…",
        "dashboard.daily_insights_loading": "Lecture de vos 90 derniers jours…",
        "dashboard.ask_anything": "Posez une question",
        "dashboard.ask_anything_sub": "Besoin de contexte sur une carte ? Demandez au Coach avec vos données FinTrack.",
        "dashboard.ask_placeholder": "Posez une question sur ces insights…",

        // Dashboard — charts
        "dashboard.income_vs_expenses": "Revenus vs Dépenses",
        "dashboard.spending_by_category": "Dépenses par catégorie",
        "dashboard.this_month": "Ce mois-ci",
        "chart.6m": "6M",
        "chart.1y": "1A",
        "chart.all": "Tout",

        // Dashboard — Accounts & Recent Transactions
        "dashboard.accounts": "Comptes",
        "dashboard.add": "+ Ajouter",
        "dashboard.recent_transactions": "Transactions récentes",
        "dashboard.view_all": "Tout voir",
        "dashboard.view_all_arrow": "Tout voir →",
        "account.checking": "Courant",
        "account.savings": "Épargne",
        "account.credit": "Crédit",
        "account.invest": "Invest.",

        // Dashboard — Budget & Investments & Goals
        "dashboard.budget_overview": "Aperçu des budgets",
        "dashboard.investment_portfolio": "Portefeuille d'investissement",
        "dashboard.total_portfolio_value": "Valeur totale du portefeuille",
        "dashboard.savings_goals": "Objectifs d'épargne",

        // Empty states
        "empty.accounts.banner": "Suivez les soldes par compte en ajoutant des transactions",
        "empty.accounts.list": "Vos comptes apparaîtront ici à mesure que vous ajoutez des transactions.",
        "empty.budgets.list": "Créez des budgets pour suivre votre progression ici.",
        "empty.invest.list": "Ajoutez des investissements pour voir vos positions ici.",
        "empty.goals.list": "Créez des objectifs pour suivre votre épargne ici.",
        "empty.invest.invested_note": "Ajoutez des investissements pour suivre le coût d'achat",
        "empty.invest.portfolio_summary": "Ajoutez des investissements pour comparer la performance.",
        "empty.recurring.due": "0 paiement à venir",

        // Recurring page — stats
        "recurring.expected_income": "Revenus prévus",
        "recurring.expected_expenses": "Dépenses prévues",
        "recurring.expected_balance": "Solde prévu",
        "recurring.due_this_week": "À venir cette semaine",
        "recurring.payments_due.zero": "0 paiement à venir",
        "recurring.payments_due.one": "1 paiement à venir",
        "recurring.payments_due.many": "{n} paiements à venir",

        // Recurring page — schedule table
        "recurring.schedule": "Calendrier récurrent",
        "recurring.schedule_subtitle": "Revenus et factures récurrents prévus selon votre calendrier enregistré.",
        "recurring.col.tx": "Transaction",
        "recurring.col.freq": "Fréquence",
        "recurring.col.next": "Prochaine date",
        "recurring.col.amount": "Montant",
        "recurring.col.status": "Statut",
        "recurring.col.action": "Action",

        // Recurring page — frequency labels
        "recurring.freq.weekly": "Hebdomadaire",
        "recurring.freq.biweekly": "Toutes les deux semaines",
        "recurring.freq.monthly": "Mensuel",
        "recurring.freq.quarterly": "Trimestriel",
        "recurring.freq.yearly": "Annuel",

        // Recurring page — status + actions
        "recurring.status.pending": "En attente",
        "recurring.status.paid": "Payé",
        "recurring.status.received": "Reçu",
        "recurring.action.mark_paid": "Marquer payé",
        "recurring.action.mark_received": "Marquer reçu",
        "recurring.action.not_due_yet": "Pas encore dû",
        "recurring.action.saving": "Enregistrement…",

        // Recurring page — due labels
        "recurring.due.overdue": "En retard",
        "recurring.due.today": "Aujourd'hui",
        "recurring.due.tomorrow": "Demain",
        "recurring.due.days_left.one": "1 jour restant",
        "recurring.due.days_left.many": "{n} jours restants",

        // Recurring page — empty state
        "recurring.empty.title": "Aucun paiement récurrent",
        "recurring.empty.text": "Ajoutez un loyer, un salaire, un abonnement ou tout paiement qui se répète.",

        // Recurring page — Detected Subscriptions card
        "recurring.detected_subs": "Abonnements détectés",
        "recurring.subs.scanning": "Analyse de vos transactions…",
        "recurring.subs.loading": "Recherche de prélèvements récurrents du même montant sur les 6 derniers mois…",
        "recurring.subs.active": "Actifs",
        "recurring.subs.monthly_total": "Total mensuel",
        "recurring.subs.possibly_unused": "Peut-être inutilisés",
        "recurring.subs.summary_mode.ai": "Résumé IA",
        "recurring.subs.summary_mode.cached": "Résumé en cache",
        "recurring.subs.summary_mode.rule": "Résumé heuristique",
        "recurring.subs.summary_mode.empty": "Aucune correspondance",
        "recurring.subs.empty_list": "Aucun prélèvement récurrent détecté. Importez plus de transactions ou attendez le prochain cycle de facturation.",
        "recurring.subs.fetch_error": "Impossible d'analyser les abonnements pour le moment. Veuillez réessayer.",
        "recurring.subs.add_failed": "Impossible d'ajouter aux paiements récurrents",
        "recurring.subs.tracked_toast": "{name} ajouté aux paiements récurrents",

        // Recurring page — subscription item meta
        "recurring.subs.charge.one": "1 prélèvement",
        "recurring.subs.charge.many": "{n} prélèvements",
        "recurring.subs.charged_today": "prélevé aujourd'hui",
        "recurring.subs.last_charged.one": "dernier prélèvement il y a 1 jour",
        "recurring.subs.last_charged.many": "dernier prélèvement il y a {n} jours",
        "recurring.subs.meta_join": " · ",
        "recurring.subs.track_btn": "Ajouter aux récurrents",
        "recurring.subs.tracked_btn": "Déjà suivi",
        "recurring.subs.adding_btn": "Ajout…",
        "recurring.subs.added_btn": "Suivi",

        // Recurring modal
        "recurring.modal.add_title": "Ajouter un paiement récurrent",
        "recurring.modal.edit_title": "Modifier le paiement récurrent",
        "recurring.modal.desc": "Ajoutez un revenu ou une facture récurrent à vos prévisions.",
        "recurring.modal.name": "Nom",
        "recurring.modal.name_placeholder": "ex. Loyer, Netflix, Salaire",
        "recurring.modal.amount": "Montant",
        "recurring.modal.amount_placeholder": "ex. 1500",
        "recurring.modal.type": "Type",
        "recurring.modal.expense": "Dépense",
        "recurring.modal.income": "Revenu",
        "recurring.modal.category": "Catégorie",
        "recurring.modal.select_category": "Choisir une catégorie",
        "recurring.modal.add": "Ajouter",
        "recurring.modal.account": "Compte",
        "recurring.modal.account_placeholder": "ex. Compte courant, Alipay",
        "recurring.modal.frequency": "Fréquence",
        "recurring.modal.next_date": "Prochaine date",
        "recurring.modal.cancel": "Annuler",
        "recurring.modal.save": "Enregistrer",
        "recurring.modal.update": "Mettre à jour",

        // Money Coach — stat cards
        "coach.stat.snapshot": "Aperçu du jour",
        "coach.stat.snapshot_value": "Aperçu",
        "coach.stat.snapshot_note": "Analyse de vos dernières données",
        "coach.stat.top_pressure": "Principale pression de dépense",
        "coach.stat.top_pressure_note": "Identification du principal poste de dépense",
        "coach.stat.safe_to_spend": "Disponible cette semaine",
        "coach.stat.safe_to_spend_note": "Après budgets, factures et objectifs.",
        "coach.stat.loading": "Chargement",

        // Money Coach — Brief
        "coach.brief.title": "Le briefing du Coach",
        "coach.brief.kicker": "En direct de vos données",
        "coach.brief.headline": "Voici où en sont vos finances aujourd'hui.",
        "coach.brief.summary": "FinTrack analyse vos transactions, budgets, objectifs et paiements récurrents pour vous donner une vue claire.",
        "coach.brief.biggest": "Principale pression de dépense",
        "coach.brief.biggest_loading": "Recherche du signal de dépense le plus important.",
        "coach.brief.best_move": "Meilleure action à prendre",
        "coach.brief.best_move_default": "Demandez au Coach avant toute décision importante — il vérifiera vos vrais chiffres.",
        "coach.brief.sees": "Ce que le Coach peut voir",

        // Money Coach — data pills
        "coach.data.transactions": "Transactions",
        "coach.data.budgets": "Budgets",
        "coach.data.goals": "Objectifs",
        "coach.data.recurring": "Récurrents",
        "coach.data.investments": "Aperçu investissements",

        // Money Coach — Saved insights & history
        "coach.saved.title": "Insights enregistrés",
        "coach.saved.count_zero": "0 ouvert",
        "coach.saved.count_one": "1 ouvert",
        "coach.saved.count_many": "{n} ouverts",
        "coach.saved.empty": "Les insights importants du Coach resteront ici jusqu'à leur résolution.",
        "coach.saved.empty_none": "Aucun insight enregistré ne nécessite votre attention.",
        "coach.saved.resolve": "Marquer comme résolu",
        "coach.saved.fallback_title": "Insight enregistré",
        "coach.history.title": "Historique récent",
        "coach.history.count_zero": "0 enregistré",
        "coach.history.count_one": "1 enregistré",
        "coach.history.count_many": "{n} enregistrés",
        "coach.history.empty": "Posez une question au Coach pour démarrer votre historique.",

        // Money Coach — Ask card
        "coach.ask.title": "Demander au Coach",
        "coach.ask.subtitle": "Posez une question concrète. Le Coach vérifie vos données FinTrack avant de répondre.",
        "coach.ask.try_one": "Essayez l'une de ces questions",
        "coach.ask.placeholder": "Ex. : Puis-je dépenser 100 € cette semaine sans risque ?",
        "coach.ask.send": "Demander au Coach",
        "coach.ask.thinking": "Réflexion…",
        "coach.ask.powered_by": "Propulsé par Claude",
        "coach.ask.status_ready": "Coach prêt",
        "coach.ask.status_thinking": "Le Coach réfléchit…",
        "coach.ask.status_streaming": "Le Coach répond…",
        "coach.ask.status_local": "Guidance locale",
        "coach.ask.status_retry": "Réessayer",
        "coach.ask.empty_warning": "Posez d'abord une question au Coach",
        "coach.ask.failed": "Le Coach a échoué",
        "coach.ask.error": "Le Coach ne peut pas répondre pour le moment",

        // Money Coach — starter chips
        "coach.starter.afford": "Puis-je me le permettre ?",
        "coach.starter.cut": "Que devrais-je réduire cette semaine ?",
        "coach.starter.bill": "Quelle facture me coûte le plus ?",
        "coach.starter.payday": "Suis-je en sécurité jusqu'à la paie ?",

        // Money Coach — response card
        "coach.response.badge": "Coach Financier",
        "coach.response.used": "Données utilisées",
        "coach.response.helpful": "Cette réponse vous a-t-elle aidé ?",
        "coach.response.helpful_yes": "Utile",
        "coach.response.helpful_no": "Pas utile",
        "coach.response.guidance": "Guidance éducative uniquement, pas un conseil financier.",

        // Money Coach — structured answer
        "coach.answer.label_main": "Coach Financier",
        "coach.answer.short": "Réponse courte",
        "coach.answer.why": "Pourquoi",
        "coach.answer.next": "Action recommandée",
        "coach.verdict.yes": "OUI",
        "coach.verdict.no": "NON",
        "coach.verdict.wait": "ATTENDRE",

        // Money Coach — dynamic stat cards
        "coach.read.good": "Tout va bien",
        "coach.read.focus": "Attention requise",
        "coach.read.review": "À examiner",
        "coach.read.none": "Aucune pression majeure détectée",
        "coach.read.over_budget": "{category} dépasse son budget",
        "coach.read.bill_soon": "{name} arrive bientôt",
        "coach.read.month_negative": "Le mois est négatif",
        "coach.read.goals_active": "Vos objectifs sont actifs",

        "coach.pressure.none": "Aucune",
        "coach.pressure.none_note": "Aucune pression urgente détectée",
        "coach.pressure.none_text": "Aucune catégorie ou facture ne se démarque comme urgente.",
        "coach.pressure.over_amount": "{amount} de dépassement",
        "coach.pressure.over_text": "{category} est la pression la plus claire — son budget est dépassé.",
        "coach.pressure.due_soon_amount": "{amount} à payer bientôt",
        "coach.pressure.bill_text": "{name} est la prochaine dépense récurrente.",
        "coach.pressure.cash_flow": "Trésorerie",
        "coach.pressure.net_month": "{amount} net ce mois-ci",
        "coach.pressure.overspend_text": "Vos dépenses mensuelles dépassent actuellement vos revenus.",
        "coach.pressure.left": "{amount} restants",
        "coach.pressure.goal_text": "{name} est votre objectif actif le plus proche.",

        // Money Coach — safe to spend
        "coach.safe.after": "Après budgets, factures et objectifs.",
        "coach.safe.fix_first": "Réglez d'abord la catégorie dépassée",
        "coach.safe.bill_room": "Gardez de la marge pour les factures à venir",
        "coach.safe.fix_net": "Ramenez le solde mensuel au-dessus de zéro",
        "coach.safe.still_protect": "Continuez à protéger votre objectif",
        "coach.safe.goal_tight": "La marge pour l'objectif est serrée",
        "coach.safe.needs_data_note": "Ajoutez des transactions, budgets, factures ou objectifs pour affiner ce chiffre.",
        "coach.safe.status.needs_data": "Données insuffisantes",
        "coach.safe.status.wait": "Attendre",
        "coach.safe.status.careful": "Prudence",
        "coach.safe.status.looks_safe": "Tout est en ordre",

        // Money Coach — brief titles & summaries
        "coach.brief.title_steady": "Vos finances sont stables",
        "coach.brief.summary_steady": "Vos données actuelles ne montrent aucun avertissement majeur. Vérifiez avant les achats importants.",
        "coach.brief.title_attention": "Votre budget nécessite votre attention",
        "coach.brief.summary_attention": "{category} dépasse de {amount}. Mettez en pause les dépenses supplémentaires avant tout nouvel achat.",
        "coach.brief.title_bill": "Une facture arrive bientôt",
        "coach.brief.summary_bill": "{name} est dû {when}. Gardez de la marge avant d'engager des dépenses supplémentaires.",
        "coach.brief.title_overspend": "Les dépenses dépassent les revenus",
        "coach.brief.summary_overspend": "Le mois est actuellement à {amount} après revenus et dépenses.",
        "coach.brief.title_protect_goal": "Protégez votre prochain objectif",
        "coach.brief.summary_goal": "{name} nécessite encore {amount}. Évitez que les dépenses supplémentaires ne le ralentissent.",

        // Money Coach — best next move
        "coach.move.steady": "Maintenez vos dépenses habituelles et vérifiez avant les achats importants.",
        "coach.move.pause_category": "Mettez en pause les dépenses dans {category} et demandez au Coach avant tout achat optionnel.",
        "coach.move.reserve_bill": "Gardez au moins {amount} disponibles pour {name}.",
        "coach.move.cut_flex": "Réduisez une dépense flexible avant d'engager de nouveaux frais.",
        "coach.move.toward_goal": "Déplacez un petit montant vers {name} avant toute dépense optionnelle.",

        // Money Coach — due labels
        "coach.due.today": "aujourd'hui",
        "coach.due.one_day": "dans 1 jour",
        "coach.due.n_days": "dans {n} jours",

        // Money Coach — Ask card extra statuses
        "coach.ask.status_saved": "Réponse enregistrée",
        "coach.ask.status_saved_local": "Guidance locale enregistrée",

        // Money Coach — data-used pills
        "coach.data.count_one": "1 élément",
        "coach.data.count_many": "{n} éléments",

        // Receipt scan
        "receipt.scan_btn": "Scanner un reçu",
        "receipt.fab": "Scanner un reçu",
        "receipt.badge_ai": "IA",
        "receipt.modal.title": "Scanner un reçu",
        "receipt.modal.desc": "Prenez une photo ou importez une image. L'IA lit le marchand, le montant, la date et la catégorie — vous confirmez.",
        "receipt.dropzone.title": "Photographiez ou déposez votre reçu",
        "receipt.dropzone.sub": "JPG, PNG, WEBP ou HEIC · jusqu'à 8 Mo",
        "receipt.tip": "Sur mobile, choisissez une photo dans votre galerie ou prenez-en une. Sur ordinateur, vous pouvez déposer une image ici.",
        "receipt.scan.reading": "Lecture de votre reçu…",
        "receipt.field.merchant": "Marchand",
        "receipt.field.amount": "Montant",
        "receipt.field.currency": "Devise",
        "receipt.field.date": "Date",
        "receipt.field.category": "Catégorie",
        "receipt.field.account": "Compte",
        "receipt.field.type": "Type",
        "receipt.confidence.high": "Confiance élevée",
        "receipt.confidence.medium": "Confiance moyenne",
        "receipt.confidence.low": "Faible confiance — vérifiez bien",
        "receipt.error.title": "Nous n'avons pas pu lire ce reçu",
        "receipt.error.msg": "Essayez une photo plus nette, ou saisissez les détails manuellement.",
        "receipt.error.network": "Erreur réseau. Vérifiez votre connexion et réessayez.",
        "receipt.error.type": "Type d'image non pris en charge. Utilisez JPG, PNG, WEBP ou HEIC.",
        "receipt.error.too_big": "L'image est trop volumineuse (max 8 Mo).",
        "receipt.error.fields": "Veuillez renseigner le marchand, le montant et la date.",
        "receipt.error.save": "Impossible d'enregistrer la transaction",
        "receipt.duplicate.confirm": "Ce reçu a déjà été scanné le {date}. Voulez-vous le scanner à nouveau ?",
        "receipt.duplicate.cancelled": "Scan annulé — ce reçu a déjà été scanné.",
        "receipt.duplicate.title": "Reçu déjà scanné",
        "receipt.duplicate.body": "Ce reçu a déjà été scanné le {date}. Vous pouvez choisir une autre photo ou le scanner à nouveau.",
        "receipt.duplicate.cancel": "Choisir une autre photo",
        "receipt.duplicate.continue": "Scanner à nouveau",
        "receipt.retry": "Essayer une autre photo",
        "receipt.manual": "Saisir manuellement",
        "receipt.save": "Enregistrer la transaction",
        "receipt.saving": "Enregistrement…",
        "receipt.toast_saved": "Transaction enregistrée depuis le reçu",

        // Cash flow forecast
        "cashflow.title": "Prévision de trésorerie",
        "cashflow.whatif_btn": "Tester un achat",
        "cashflow.whatif_sub": "Voyez s'il passe sur 30 jours",
        "cashflow.loading_kicker": "Lecture de vos données…",
        "cashflow.loading_text": "Construction des 30 prochains jours.",
        "cashflow.error": "Impossible de charger la prévision. Réessayez.",
        "billing.trial_expired_kicker": "Essai terminé",
        "billing.trial_expired": "Votre essai est terminé. Abonnez-vous pour continuer à utiliser la prévision.",
        "cashflow.kicker.good": "Tout va bien",
        "cashflow.kicker.warn": "Marge serrée",
        "cashflow.kicker.danger": "Alerte",
        "cashflow.headline.good": "Vous aurez environ {amount} disponibles dans 30 jours.",
        "cashflow.headline.tight": "Votre point le plus bas est {amount} le {date} — limitez les dépenses supplémentaires d'ici là.",
        "cashflow.headline.zero": "Vous risquez d'être à découvert le {date}.",
        "cashflow.today": "Aujourd'hui",
        "cashflow.lowest": "Point le plus bas",
        "cashflow.end_of_window": "Dans 30 jours",

        // What-if simulator
        "whatif.modal.title": "Et si vous achetiez ceci ?",
        "whatif.modal.desc": "Planifiez un achat et voyez son impact sur votre trésorerie des 30 prochains jours.",
        "whatif.field.amount": "Montant",
        "whatif.field.amount_placeholder": "ex. 1500",
        "whatif.field.label": "C'est quoi ?",
        "whatif.field.label_placeholder": "Nouveau portable, week-end…",
        "whatif.field.when": "Quand ?",
        "whatif.field.category": "Catégorie (optionnel)",
        "whatif.field.category_placeholder": "Achats, Voyage…",
        "whatif.run": "Voir l'impact",
        "whatif.simulating": "Simulation…",
        "whatif.verdict.yes": "Oui, vous pouvez",
        "whatif.verdict.wait": "Attendez",
        "whatif.verdict.no": "Pas encore",
        "whatif.reason.yes": "Après cet achat, il vous resterait environ {end} en fin de mois.",
        "whatif.reason.wait": "Il vous resterait environ {min} au point le plus bas. Attendez après la prochaine paie pour une marge confortable.",
        "whatif.reason.no": "Cela vous mettrait à découvert vers le {date}.",
        "whatif.impact.end": "Dans 30 jours",
        "whatif.impact.min": "Point le plus bas",
        "whatif.error.amount": "Saisissez un montant à simuler.",
        "whatif.error.failed": "Impossible de lancer la simulation",

        // Money Coach — empty states
        "coach.history.empty_title": "Aucune question pour le moment",
        "coach.saved.empty_title": "Tout est en ordre",

        // Category picker modal
        "category_picker.title": "Choisir une catégorie",
        "category_picker.desc": "Sélectionnez une catégorie pour {ctx}.",
        "category_picker.ctx.transaction": "cette transaction",
        "category_picker.ctx.budget": "ce budget",
        "category_picker.ctx.recurring": "ce paiement récurrent",
        "category_picker.ctx.goal": "cet objectif",
        "category_picker.ctx.default": "cet élément",

        // Time
        "time.today": "aujourd'hui",
        "time.yesterday": "hier",

        // Transactions page — top bar
        "tx.all_transactions": "Toutes les transactions",
        "tx.export": "Exporter",
        "tx.delete_all": "Tout supprimer",
        "tx.add_transaction": "Ajouter une transaction",

        // Transactions page — summary cards
        "tx.visible_income": "Revenus visibles",
        "tx.visible_expenses": "Dépenses visibles",
        "tx.visible_net": "Solde net visible",
        "tx.activity": "Activité",
        "tx.no_visible": "0 transaction visible",
        "tx.visible_count.one": "{n} transaction visible",
        "tx.visible_count.other": "{n} transactions visibles",

        // Transactions page — filters
        "tx.search_placeholder": "Rechercher transactions, catégories, comptes…",
        "tx.all_types": "Tous les types",
        "tx.income": "Revenu",
        "tx.expense": "Dépense",
        "tx.all_categories": "Toutes les catégories",
        "tx.clear_filters": "Effacer les filtres",
        "tx.more_filters": "Plus de filtres",
        "tx.filter_by_category": "Filtrer par catégorie",
        "tx.filter_by_category_desc": "Choisissez une catégorie pour filtrer vos transactions.",
        "tx.search_categories": "Rechercher des catégories…",
        "tx.advanced_filters": "Filtres avancés",
        "tx.clear_all": "Tout effacer",
        "tx.account": "Compte",
        "tx.all_accounts": "Tous les comptes",
        "tx.sort_by": "Trier par",
        "tx.sort.newest": "Du plus récent",
        "tx.sort.oldest": "Du plus ancien",
        "tx.sort.highest": "Montant décroissant",
        "tx.sort.lowest": "Montant croissant",
        "tx.sort.name_az": "Nom A–Z",
        "tx.sort.name_za": "Nom Z–A",
        "tx.from_date": "Date de début",
        "tx.to_date": "Date de fin",

        // Transactions page — table & pagination
        "tx.col.transaction": "Transaction",
        "tx.col.type": "Type",
        "tx.col.category": "Catégorie",
        "tx.col.account": "Compte",
        "tx.col.date": "Date",
        "tx.col.amount": "Montant",
        "tx.edit_tooltip": "Modifier la transaction",
        "tx.delete_tooltip": "Supprimer la transaction",
        "tx.pagination.showing": "Affichage {from}–{to} sur {total} transactions",
        "tx.previous": "← Précédent",
        "tx.next": "Suivant →",
        "tx.empty.no_match.title": "Aucune transaction correspondante",
        "tx.empty.no_match.text": "Essayez d'ajuster vos filtres ou réinitialisez-les pour voir plus de résultats.",
        "tx.empty.no_tx.title": "Aucune transaction pour le moment",
        "tx.empty.no_tx.text": "Commencez par ajouter votre première transaction ou en important un fichier CSV.",
        "tx.no_categories_found": "Aucune catégorie trouvée.",

        // Default categories
        "category.income": "Revenu",
        "category.groceries": "Alimentation",
        "category.entertainment": "Divertissement",
        "category.transport": "Transport",
        "category.utilities": "Services publics",
        "category.housing": "Logement",
        "category.dining": "Restauration",
        "category.health": "Santé",
        "category.shopping": "Achats",
        "category.other": "Autre",

        // Budgets page — stats
        "budgets.total_budget": "Budget total",
        "budgets.total_spent": "Total dépensé",
        "budgets.remaining": "Restant",
        "budgets.overspent_categories": "Catégories dépassées",
        "budgets.overspent_desc": "Dépenses au-delà des budgets par catégorie",

        // Budgets page — section header
        "budgets.flexible_budgets": "Budgets flexibles",
        "budgets.create_budget": "+ Créer un budget",

        // Budgets — AI-suggested budgets
        "budgets.suggestions.title": "Budgets suggérés",
        "budgets.suggestions.subtitle": "Basé sur vos 90 derniers jours",
        "budgets.suggestions.window_90": "Basé sur vos 90 derniers jours",
        "budgets.suggestions.window_partial": "Basé sur vos {n} derniers jours",
        "budgets.suggestions.desc": "Nous avons calculé ce que vous dépensez réellement par catégorie. Cliquez sur une suggestion pour créer ce budget en un clic — vous pouvez l'ajuster avant d'enregistrer.",
        "budgets.suggestions.tooltip": "Moyenne 90 jours : {avg}",

        // Budgets — pace projection on each card
        "budgets.pace.overrun": "Au rythme actuel : {projected} en fin de mois · dépassement le {date}",
        "budgets.pace.on_track": "Au rythme actuel : {projected} en fin de mois · dans le budget",

        // Budgets — misc
        "budgets.per_month_suffix": "/mois",
        "budgets.income_hidden.one": "1 objectif de revenu est masqué ici — suivez vos revenus dans Paiements récurrents.",
        "budgets.income_hidden.many": "{n} objectifs de revenu sont masqués ici — suivez vos revenus dans Paiements récurrents.",

        // Budgets page — demo card labels
        "budgets.demo.dining_out": "Restauration",
        "budgets.demo.transportation": "Transport",
        "budgets.transactions": "transactions",
        "budgets.of": "sur",
        "budgets.left": "restant",
        "budgets.vs_last_month": "vs mois dernier",
        "budgets.no_change": "Aucun changement",

        // Budgets page — dynamic JS strings
        "budgets.empty.title": "Aucun budget pour le moment",
        "budgets.empty.text": "Créez un budget pour suivre vos dépenses par catégorie.",
        "budgets.uncategorized": "Non catégorisé",
        "budgets.budget_suffix": "de budget",
        "budgets.used": "utilisé",
        "budgets.days.suffix": "jours",
        "budgets.days.ended": "Terminé",
        "budgets.days.ends_today": "Se termine aujourd'hui",
        "budgets.days.one_left": "1 jour restant",
        "budgets.days.n_left": "{n} jours restants",
        "budgets.status.over": "Dépassé",
        "budgets.status.at_limit": "Limite atteinte",
        "budgets.status.near": "Proche de la limite",
        "budgets.status.on_track": "Dans les clous",
        "budgets.source.one": "Calculé sur {n} transaction",
        "budgets.source.other": "Calculé sur {n} transactions",

        // Budgets — modal
        "budgets.modal.create_title": "Créer un budget",
        "budgets.modal.edit_title": "Modifier le budget",
        "budgets.modal.desc": "Créez un budget pour une catégorie et une période.",
        "budgets.modal.category": "Catégorie",
        "budgets.modal.select_category": "Choisir une catégorie",
        "budgets.modal.add": "Ajouter",
        "budgets.modal.amount": "Montant",
        "budgets.modal.amount_placeholder": "ex. 500",
        "budgets.modal.start_date": "Date de début",
        "budgets.modal.end_date": "Date de fin",
        "budgets.modal.length": "Durée du budget",
        "budgets.modal.length_placeholder": "ex. 7",
        "budgets.modal.quick_duration": "Durée rapide",
        "budgets.modal.quick_duration_hint": "Facultatif. Choisissez un préréglage pour remplir la date de fin, ou Aucun et utilisez votre propre date.",
        "budgets.modal.duration_none": "Aucun",
        "budgets.modal.weekly": "Hebdomadaire",
        "budgets.modal.two_weeks": "2 semaines",
        "budgets.modal.monthly": "Mensuel",
        "budgets.modal.quarterly": "Trimestriel",
        "budgets.modal.tracking_rule": "Règle de suivi",
        "budgets.modal.category_only": "Catégorie uniquement",
        "budgets.modal.category_keyword": "Catégorie + mot-clé",
        "budgets.modal.keyword": "Mot-clé",
        "budgets.modal.keyword_placeholder": "ex. thaïlande, ordinateur, mariage",
        "budgets.modal.keyword_hint": "Utilisez ceci lorsqu'un budget doit aussi inclure les transactions dont le nom contient ce mot.",
        "budgets.modal.delete": "Supprimer le budget",
        "budgets.modal.view_matched": "Voir les transactions correspondantes",
        "budgets.modal.save_budget": "Enregistrer le budget",

        // Common
        "common.cancel": "Annuler",
        "common.on": "ACTIVÉ",
        "common.off": "DÉSACTIVÉ",

        // Goals — stats
        "goals.total_saved": "Total épargné",
        "goals.target_total": "Total visé",
        "goals.completed": "Objectifs atteints",
        "goals.plan": "Plan d'objectifs",
        "goals.plan_desc": "Suivez ce que vous épargnez, où vous en êtes, et ce qui mérite votre attention.",
        "goals.note.across_active": "Sur les objectifs actifs",
        "goals.note.build_plan": "Construisez votre plan",
        "goals.note.across_one": "Sur {n} objectif",
        "goals.note.across_other": "Sur {n} objectifs",
        "goals.note.pct_complete": "{pct} % atteint",
        "goals.note.nice_progress": "Beaux progrès",
        "goals.note.keep_going": "Continuez",

        // Goals — status & details
        "goals.status.completed": "Atteint",
        "goals.status.no_timeline": "Sans échéance",
        "goals.status.missed": "Échéance dépassée",
        "goals.status.needs_attention": "Attention requise",
        "goals.status.on_track": "Dans les clous",
        "goals.status.behind": "En retard",
        "goals.status.ahead": "En avance",
        "goals.detail.target_reached": "Objectif atteint",
        "goals.detail.add_date": "Ajoutez une date cible",
        "goals.detail.left_after": "Il reste {amount} après le {date}",
        "goals.detail.left_by": "Il reste {amount} avant le {date}",
        "goals.detail.left": "Il reste {amount}",

        // Goals — dates & reminders
        "goals.target": "Cible :",
        "goals.no_target_date": "Sans date cible",
        "goals.days.one_overdue": "1 jour de retard",
        "goals.days.n_overdue": "{n} jours de retard",
        "goals.days.due_today": "à atteindre aujourd'hui",
        "goals.days.one_left": "1 jour restant",
        "goals.days.n_left": "{n} jours restants",
        "goals.reminder.no_savings": "Vous n'avez pas ajouté d'épargne à cet objectif depuis {n} jours",
        "goals.reminder.no_recent": "Vous n'avez pas alimenté cet objectif depuis {n} jours",

        // Goals — card content
        "goals.default_category": "Épargne",
        "goals.untitled": "Objectif sans nom",
        "goals.saved": "Épargné",
        "goals.added": "ajoutés",
        "goals.complete": "atteint",
        "goals.to_go": "restants",
        "goals.save_monthly": "Épargnez {amount}/mois pour atteindre l'objectif",
        "goals.this_goal": "cet objectif",

        // Goals — auto savings
        "goals.auto_savings": "Épargne auto",
        "goals.auto.includes": "Inclut l'épargne automatique",
        "goals.auto.watching": "L'épargne auto surveille {cat}",
        "goals.auto.off": "Épargne auto désactivée",
        "goals.auto.detail_on": "FinTrack ajoute automatiquement à cet objectif les transactions d'épargne de la catégorie {cat}.",
        "goals.auto.detail_off": "L'épargne auto est désactivée pour {cat}. Activez-la pour inclure les transactions d'épargne correspondantes.",
        "goals.auto_for": "Épargne auto pour {cat}",
        "goals.turn_on": "Activer",
        "goals.turn_off": "Désactiver",
        "goals.turning_on": "Activation…",
        "goals.turning_off": "Désactivation…",
        "goals.toast.auto_on": "Épargne auto activée pour {cat}",
        "goals.toast.auto_off": "Épargne auto désactivée pour {cat}",
        "goals.toast.auto_error": "Impossible de mettre à jour l'épargne auto",

        // Goals — breakdown / details
        "goals.view_details": "Voir les détails",
        "goals.hide_details": "Masquer les détails",
        "goals.savings_details": "Détails de l'épargne",
        "goals.you_added": "Vos ajouts",
        "goals.auto_added": "Ajouts automatiques",
        "goals.history": "Historique",
        "goals.history_hint": "Ouvrez les détails pour charger l'historique.",
        "goals.coach_suggestions": "Suggestions du Coach Financier",
        "goals.coach_hint": "Ouvrez les détails pour charger les suggestions du Coach Financier.",
        "goals.add_savings": "+ Ajouter de l'épargne",
        "goals.edit_tooltip": "Modifier l'objectif",
        "goals.delete_tooltip": "Supprimer l'objectif",
        "goals.empty.title": "Aucun objectif pour le moment",
        "goals.empty.text": "Créez votre premier objectif et FinTrack suivra vos progrès ici.",

        // Dynamic search placeholders
        "topnav.search_budgets": "Rechercher des budgets…",
        "topnav.search_goals": "Rechercher des objectifs…",
        "topnav.search_investments": "Rechercher des investissements…",
        "topnav.search_default": "Rechercher…",

        // Goals — Edit/Create modal
        "goals.modal.create_title": "Créer un objectif",
        "goals.modal.edit_title": "Modifier l'objectif",
        "goals.modal.create_desc": "Créez un nouvel objectif d'épargne et suivez vos progrès.",
        "goals.modal.edit_desc": "Mettez à jour cet objectif et gardez votre plan d'épargne à jour.",
        "goals.modal.name": "Nom de l'objectif",
        "goals.modal.name_placeholder": "ex. Voyage de rêve",
        "goals.modal.target_amount": "Montant cible",
        "goals.modal.target_placeholder": "ex. 5000",
        "goals.modal.current_saved": "Déjà épargné",
        "goals.modal.saved_placeholder": "ex. 1200",
        "goals.modal.target_date": "Date cible",
        "goals.modal.auto_savings": "Épargne auto",
        "goals.modal.auto_can": "FinTrack peut ajouter automatiquement les épargnes correspondantes à cet objectif.",
        "goals.modal.auto_does": "FinTrack ajoute automatiquement les épargnes correspondantes à cet objectif.",
        "goals.modal.save_goal": "Enregistrer l'objectif",

        // Goals — Add Savings (contribution) modal
        "goals.contrib.title": "Ajouter de l'épargne",
        "goals.contrib.desc": "Ajoutez de l'épargne pour cet objectif.",
        "goals.contrib.desc_for": "Ajoutez de l'épargne pour {goal}.",
        "goals.contrib.amount_placeholder": "ex. 250",
        "goals.contrib.date": "Date",
        "goals.contrib.note": "Note",
        "goals.contrib.note_placeholder": "Facultatif",
        "goals.add_savings_btn": "Ajouter l'épargne",
        "goals.toast.savings_added": "Épargne ajoutée",
        "goals.toast.savings_error": "Impossible d'ajouter l'épargne",

        // Goals — savings history
        "goals.history.loading": "Chargement de l'historique…",
        "goals.history.error": "Échec du chargement de l'historique",
        "goals.history.empty": "Aucun historique d'épargne pour l'instant. Vos ajouts manuels et les transactions d'épargne correspondantes apparaîtront ici.",
        "goals.history.could_not_load": "Impossible de charger l'historique.",
        "goals.history.source.auto": "Ajouté automatiquement depuis une transaction",
        "goals.history.source.manual": "Ajout manuel",
        "goals.history.note.matched": "Transaction d'épargne correspondante",
        "goals.history.note.manual": "Épargne manuelle",

        // Goals — Money Coach suggestions
        "goals.sugg.empty": "Aucune suggestion disponible pour l'instant.",
        "goals.sugg.smart_move": "Bonne idée",
        "goals.sugg.loading": "Le Coach Financier analyse cet objectif…",
        "goals.sugg.error": "Échec du chargement des suggestions",
        "goals.sugg.this_category": "cette catégorie",
        "goals.sugg.add_context.title": "Ajouter du contexte",
        "goals.sugg.add_context.action": "Ajoutez quelques transactions récentes pour que le Coach Financier puisse identifier de réelles opportunités d'épargne.",
        "goals.sugg.add_context.why": "De meilleures données transforment ce conseil générique en un plan personnalisé.",
        "goals.sugg.complete.title": "Objectif atteint",
        "goals.sugg.complete.action": "Orientez les nouvelles épargnes vers votre prochaine priorité plutôt que de laisser cet argent inutilisé.",
        "goals.sugg.complete.why": "Un objectif atteint devrait alimenter automatiquement la dynamique du suivant.",
        "goals.sugg.week.title": "Cette semaine",
        "goals.sugg.week.action": "Transférez {amount} sur cet objectif cette semaine au lieu d'attendre la fin du mois.",
        "goals.sugg.week.why": "Des virements hebdomadaires plus petits rendent la cible plus facile et réduisent la pression de dernière minute.",
        "goals.sugg.tradeoff.title": "Compromis à essayer",
        "goals.sugg.tradeoff.action": "Choisissez un achat flexible dans {cat} et redirigez-le vers l'objectif.",
        "goals.sugg.tradeoff.why": "Même une seule dépense évitée peut rendre {goal} actif plutôt que lointain.",
        "goals.sugg.auto.title": "Rendre cela automatique",
        "goals.sugg.auto.action_on": "Vérifiez le montant ajouté automatiquement après votre prochaine transaction d'épargne et retirez-le s'il correspond à la mauvaise catégorie.",
        "goals.sugg.auto.action_off": "Activez l'épargne auto pour cet objectif afin que les épargnes correspondantes soient ajoutées sans effort.",
        "goals.sugg.auto.why": "L'automatisation aide l'objectif à progresser même lorsque vous oubliez de le mettre à jour manuellement.",

        // CSV upload modal
        "csv.modal.title": "Importer un CSV",
        "csv.modal.desc": "Téléversez votre relevé bancaire CSV depuis WeChat Pay, Alipay ou toute autre banque.",
        "csv.dropzone.title": "Glissez-déposez votre CSV ici",
        "csv.dropzone.or_prefix": "ou",
        "csv.dropzone.browse": "parcourir les fichiers",
        "csv.status_ready": "Choisissez un fichier CSV, puis cliquez sur Téléverser et importer.",
        "csv.upload_btn": "Téléverser et importer",

        // Add/Edit Transaction modal
        "tx.modal.add_title": "Ajouter une transaction",
        "tx.modal.edit_title": "Modifier la transaction",
        "tx.modal.desc": "Ajoutez manuellement un nouveau revenu ou une dépense.",
        "tx.modal.edit_desc": "Mettez à jour les détails de cette transaction.",
        "tx.modal.name": "Nom",
        "tx.modal.name_placeholder": "ex. Salaire, Uber, Épicerie",
        "tx.modal.amount": "Montant",
        "tx.modal.amount_placeholder": "ex. 120,50",
        "tx.modal.type": "Type",
        "tx.modal.select_account": "Choisir un compte",
        "tx.modal.save": "Enregistrer la transaction",
        "tx.modal.save_changes": "Enregistrer les modifications",

        // Account options
        "account.cash": "Espèces",
        "account.investment": "Investissement",
        "account.bank_import": "Import bancaire",

        // Quick Add Category modal
        "cat_quick.title": "Ajouter une catégorie",
        "cat_quick.desc": "Créez une nouvelle catégorie sans quitter votre formulaire de transaction.",
        "cat_quick.name": "Nom de la catégorie",
        "cat_quick.name_placeholder": "ex. Café, Essence, Cadeaux",
        "cat_quick.icon": "Icône de catégorie",
        "cat_quick.choose_icon": "Choisir une icône",
        "cat_quick.save": "Enregistrer la catégorie",

        // Category Icon Picker modal
        "icon_picker.title": "Choisir une icône de catégorie",
        "icon_picker.desc": "Sélectionnez une icône pour cette catégorie ou utilisez votre propre emoji.",
        "icon_picker.selected": "Icône sélectionnée",
        "icon_picker.search": "Rechercher des icônes…",
        "icon_picker.own_emoji": "Utilisez votre propre emoji",
        "icon_picker.paste_emoji": "Collez n'importe quel emoji",
        "icon_picker.use": "Utiliser",
        "icon_picker.popular": "Populaires",
        "icon_picker.all": "Toutes les icônes",

        // Delete confirmation modals
        "delete.goal.title": "Supprimer l'objectif",
        "delete.goal.desc": "Êtes-vous sûr de vouloir supprimer cet objectif ? Vos progrès enregistrés pour cet objectif seront retirés de ce plan.",
        "delete.tx.title": "Supprimer la transaction",
        "delete.tx.desc": "Êtes-vous sûr de vouloir supprimer cette transaction ? Cette action est irréversible.",
        "delete.tx_all.title": "Supprimer toutes les transactions",
        "delete.tx_all.desc": "Êtes-vous sûr de vouloir supprimer toutes les transactions ? Cette action est irréversible.",
        "delete.tx_all.confirm": "Tout supprimer",
        "delete.budget.title": "Supprimer le budget",
        "delete.budget.desc": "Êtes-vous sûr de vouloir supprimer ce budget ? Cette action est irréversible.",
        "delete.recurring.title": "Supprimer le paiement récurrent",
        "delete.recurring.desc": "Êtes-vous sûr de vouloir supprimer ce paiement récurrent ? Il sera retiré de vos prévisions.",

        // Common
        "common.delete": "Supprimer",
        "common.got_it": "Compris",

        // Investments — preview & coming-soon
        "invest.preview.title": "Aperçu des investissements",
        "invest.preview.kicker": "Bientôt disponible",
        "invest.preview.hero_title": "L'intelligence d'investissement est en aperçu",
        "invest.preview.hero_text": "Vous pouvez explorer la page Investissements dès maintenant, mais certaines analyses utilisent encore des calculs de démonstration jusqu'à ce que les API de données de production soient connectées.",
        "invest.preview.avail": "Disponible en aperçu",
        "invest.preview.avail_text": "Cartes de portefeuille, allocation, graphiques, positions, rapports et conseils.",
        "invest.preview.prep": "Encore en préparation",
        "invest.preview.prep_text": "Synchronisation en direct avec le courtier, lots fiscaux, dividendes, actualités et données analystes.",
        "invest.preview.stay": "Rester ici",
        "invest.preview.continue": "Aperçu des investissements",
        "invest.add.title": "Ajouter un investissement",
        "invest.add.desc1": "Le suivi manuel des investissements arrive bientôt. Cela nécessite de vraies positions, des lots d'achat/vente, le coût moyen et le stockage des données de marché pour que votre portefeuille reste précis.",
        "invest.add.desc2": "Pour le moment, l'intelligence d'investissement reste visible comme feuille de route, mais les fonctionnalités avancées sont verrouillées jusqu'à ce que le back-end fiable soit prêt.",

        // Settings — Danger zone (Delete account)
        "settings.section.danger": "Zone dangereuse",
        "settings.danger.desc": "Actions permanentes. Pas de retour en arrière.",
        "settings.delete_account": "Supprimer le compte",
        "settings.delete_account.desc": "Efface vos transactions, budgets, objectifs et votre compte. Action irréversible.",
        "settings.delete_account.cta": "Supprimer mon compte",
        "delete.account.title": "Supprimer votre compte FinTrack",
        "delete.account.desc": "Cela efface définitivement vos transactions, budgets, objectifs, paiements récurrents et votre compte. Aucune récupération possible après.",
        "delete.account.bullet_data": "Toutes vos données sont retirées de nos serveurs sous 30 jours.",
        "delete.account.bullet_subscription": "Si vous avez un abonnement actif, annulez-le d'abord dans Paramètres → Facturation.",
        "delete.account.bullet_email": "Cette adresse e-mail ne pourra plus ouvrir de nouvel essai FinTrack — par conception.",
        "delete.account.label": "Tapez le mot <code>delete</code> pour confirmer :",
        "delete.account.confirm": "Supprimer mon compte",
        "delete.account.deleting": "Suppression…",
        "delete.account.error_generic": "Impossible de supprimer le compte. Veuillez réessayer."
    },

    es: {
        // Sidebar
        "sidebar.overview": "VISIÓN GENERAL",
        "sidebar.home": "Inicio",
        "sidebar.transactions": "Transacciones",
        "sidebar.budgets": "Presupuestos",
        "sidebar.goals": "Metas",
        "sidebar.investments": "Inversiones",
        "sidebar.recurring": "Pagos recurrentes",
        "sidebar.coach": "Coach Financiero",
        "sidebar.settings": "Ajustes",
        "auth.logout": "Cerrar sesión",

        // User plan
        "plan.premium": "Plan Premium",
        "plan.trial": "Prueba gratuita",

        // Trial countdown banner
        "trial.banner.cta": "Suscribirse",
        "trial.banner.days_left": "Te quedan {n} días de prueba gratuita.",
        "trial.banner.urgent": "Solo {n} días de prueba — suscríbete para conservar tus datos.",
        "trial.banner.last_day": "Último día de prueba gratuita — suscríbete para mantener el acceso.",
        "trial.banner.expired": "Tu prueba ha terminado — suscríbete para conservar tus datos.",

        // Topnav
        "topnav.search": "Buscar transacciones…",
        "topnav.toggle_theme": "Cambiar tema",
        "topnav.add_new": "Agregar",
        "topnav.add_recurring": "Agregar pago",
        "topnav.add_goal": "Agregar meta",
        "topnav.add_investment": "Agregar inversión",

        // Page meta
        "page.dashboard.title": "Inicio",
        "page.dashboard.sub": "Tu resumen financiero de un vistazo.",
        "page.transactions.title": "Transacciones",
        "page.transactions.sub": "Visualiza de dónde viene y a dónde va tu dinero.",
        "page.budgets.title": "Presupuestos",
        "page.budgets.sub": "Sigue tus presupuestos semanales, mensuales y personalizados.",
        "page.goals.title": "Metas",
        "page.goals.sub": "Sigue tu progreso de ahorro y tus planes futuros.",
        "page.investments.title": "Inversiones",
        "page.investments.sub": "Monitorea el rendimiento de tus inversiones.",
        "page.recurring.title": "Pagos recurrentes",
        "page.recurring.sub": "Gestiona tus facturas, suscripciones e ingresos recurrentes.",
        "page.categories.title": "Coach Financiero",
        "page.categories.sub": "Haz preguntas y obtén consejos basados en tus datos de FinTrack.",
        "page.settings.title": "Ajustes",
        "page.settings.sub": "Personaliza tu experiencia en FinTrack.",

        // Settings — Profile
        "settings.section.profile": "Perfil",
        "settings.profile.desc": "Gestiona tu información personal",
        "settings.avatar.upload": "Subir foto de perfil",
        "settings.first_name": "Nombre",
        "settings.last_name": "Apellido",
        "settings.email": "Correo electrónico",
        "settings.phone": "Teléfono",
        "settings.save_changes": "Guardar cambios",

        // Settings — Preferences
        "settings.section.preferences": "Preferencias",
        "settings.preferences.desc": "Personaliza tu experiencia",
        "settings.currency": "Moneda",
        "settings.language": "Idioma",
        "settings.date_format": "Formato de fecha",
        "settings.first_day": "Primer día de la semana",
        "settings.save_preferences": "Guardar preferencias",
        "day.sunday": "Domingo",
        "day.monday": "Lunes",

        // Settings — Security
        "settings.section.security": "Seguridad",
        "settings.security.desc": "Gestiona los ajustes de seguridad de tu cuenta",
        "settings.2fa": "Autenticación de dos factores",
        "settings.2fa.desc": "Añade una capa de seguridad adicional a tu cuenta",
        "settings.enable": "Activar",
        "settings.change_password": "Cambiar contraseña",
        "settings.change_password.desc": "Actualiza tu contraseña con regularidad para mayor seguridad",
        "settings.change": "Cambiar",
        "settings.billing.title": "Facturación",
        "settings.billing.desc": "Gestiona tu suscripción a FinTrack Pro.",
        "settings.billing.pro": "FinTrack Pro",
        "settings.billing.status_trial": "Prueba de 14 días, luego $4.99 USD/mes o $6.99 CAD/mes.",
        "settings.billing.status_active": "Tu suscripción a FinTrack Pro está activa.",
        "settings.billing.status_expired": "Tu prueba terminó. Suscríbete para continuar.",
        "settings.billing.subscribe": "Suscribirme",
        "settings.billing.cancel": "Cancelar suscripción",
        "settings.billing.manage": "Gestionar suscripción",
        "settings.billing.portal_hint": "Actualiza tu tarjeta o consulta facturas desde el portal seguro de Stripe.",
        "settings.billing.portal_error": "No se pudo abrir el portal de facturación",
        "settings.billing.redirecting": "Redirigiendo…",
        "settings.billing.canceling": "Cancelando…",
        "settings.billing.error": "No se pudo iniciar el pago",
        "settings.billing.cancel_error": "No se pudo cancelar la suscripción",
        "settings.billing.cancel_success": "Cancelación de suscripción programada.",
        "settings.billing.status_cancel_scheduled": "Tu suscripción está programada para cancelarse el {date}. Mantienes FinTrack Pro hasta entonces.",
        "settings.billing.status_trial_stripe": "Tu prueba de Stripe está activa. Cancela antes del {date} para evitar el primer cobro.",
        "settings.billing.status_trial_stripe_no_date": "Tu prueba de Stripe está activa. Puedes cancelar antes de que termine la prueba.",
        "settings.billing.status_past_due": "El pago necesita atención. Gestiona tu suscripción para mantener el acceso.",
        "settings.billing.period_unknown": "Fin del periodo de facturación",

        // Settings — Your data (export)
        "settings.section.data": "Tus datos",
        "settings.data.desc": "Descarga todo lo que has guardado en FinTrack como un archivo ZIP de archivos CSV.",
        "settings.data.export": "Exportar tus datos",
        "settings.data.export_desc": "Transacciones, presupuestos, metas, pagos recurrentes y el historial del Coach Financiero — todo en un archivo descargable.",
        "settings.data.download": "Descargar .zip",
        "settings.data.preparing": "Preparando…",
        "settings.data.downloaded": "Tu descarga ha comenzado.",
        "settings.data.error": "No se pudo preparar la exportación. Inténtalo de nuevo.",

        "settings.billing.cancel_modal.title": "¿Cancelar FinTrack Pro?",
        "settings.billing.cancel_modal.desc": "Tu suscripción seguirá activa hasta el final del periodo de facturación actual. Puedes seguir usando FinTrack Pro hasta entonces.",
        "settings.billing.cancel_modal.period_label": "Acceso hasta",
        "settings.billing.cancel_modal.no_renewal": "No cobraremos otra renovación mensual después de esta fecha.",
        "settings.billing.cancel_modal.keep": "Mantener suscripción",
        "settings.billing.cancel_modal.confirm": "Confirmar cancelación",

        // Toasts
        "toast.profile_updated": "Perfil actualizado",
        "toast.profile_error": "No se pudieron guardar los cambios",
        "toast.preferences_saved": "Preferencias guardadas",
        "toast.preferences_error": "No se pudieron guardar las preferencias",
        "toast.saving": "Guardando…",

        // Country picker
        "phone.country_placeholder": "País",
        "currency.placeholder": "Elegir una moneda",

        // Dashboard — stat cards
        "dashboard.total_balance": "Saldo total",
        "dashboard.monthly_income": "Ingresos del mes",
        "dashboard.monthly_expenses": "Gastos del mes",
        "dashboard.total_savings": "Ahorros totales",

        // Dashboard — Quick Actions
        "dashboard.quick_actions": "Acciones rápidas",
        "dashboard.transfer": "Transferencia",
        "dashboard.deposit": "Depósito",
        "dashboard.withdraw": "Retiro",
        "dashboard.pay_bills": "Pagar una factura",
        "dashboard.recurring": "Recurrentes",
        "dashboard.calculator": "Calculadora",
        "dashboard.import_csv": "Importar CSV",
        "dashboard.daily_insights": "Insights diarios",
        "dashboard.daily_insights_scanning": "Analizando tus últimos 90 días…",
        "dashboard.daily_insights_loading": "Leyendo tus últimos 90 días…",
        "dashboard.ask_anything": "Haz una pregunta",
        "dashboard.ask_anything_sub": "¿Necesitas contexto sobre una tarjeta? Pregúntale al Coach con tus datos de FinTrack.",
        "dashboard.ask_placeholder": "Haz una pregunta sobre estos insights…",

        // Dashboard — charts
        "dashboard.income_vs_expenses": "Ingresos vs Gastos",
        "dashboard.spending_by_category": "Gastos por categoría",
        "dashboard.this_month": "Este mes",
        "chart.6m": "6M",
        "chart.1y": "1A",
        "chart.all": "Todo",

        // Dashboard — Accounts & Recent Transactions
        "dashboard.accounts": "Cuentas",
        "dashboard.add": "+ Agregar",
        "dashboard.recent_transactions": "Transacciones recientes",
        "dashboard.view_all": "Ver todo",
        "dashboard.view_all_arrow": "Ver todo →",
        "account.checking": "Corriente",
        "account.savings": "Ahorros",
        "account.credit": "Crédito",
        "account.invest": "Inversión",

        // Dashboard — Budget & Investments & Goals
        "dashboard.budget_overview": "Resumen de presupuestos",
        "dashboard.investment_portfolio": "Cartera de inversiones",
        "dashboard.total_portfolio_value": "Valor total de la cartera",
        "dashboard.savings_goals": "Metas de ahorro",

        // Empty states
        "empty.accounts.banner": "Sigue saldos por cuenta agregando transacciones",
        "empty.accounts.list": "Tus cuentas aparecerán aquí a medida que añadas transacciones.",
        "empty.budgets.list": "Crea presupuestos para seguir tu progreso aquí.",
        "empty.invest.list": "Agrega inversiones para ver tus posiciones aquí.",
        "empty.goals.list": "Crea metas para seguir tus ahorros aquí.",
        "empty.invest.invested_note": "Agrega inversiones para hacer seguimiento del costo de compra",
        "empty.invest.portfolio_summary": "Agrega inversiones para comparar el rendimiento.",
        "empty.recurring.due": "0 pagos próximos",

        // Recurring page — stats
        "recurring.expected_income": "Ingresos previstos",
        "recurring.expected_expenses": "Gastos previstos",
        "recurring.expected_balance": "Saldo previsto",
        "recurring.due_this_week": "Próximos esta semana",
        "recurring.payments_due.zero": "0 pagos próximos",
        "recurring.payments_due.one": "1 pago próximo",
        "recurring.payments_due.many": "{n} pagos próximos",

        // Recurring page — schedule table
        "recurring.schedule": "Calendario recurrente",
        "recurring.schedule_subtitle": "Ingresos y facturas recurrentes previstos según tu calendario guardado.",
        "recurring.col.tx": "Transacción",
        "recurring.col.freq": "Frecuencia",
        "recurring.col.next": "Próxima fecha",
        "recurring.col.amount": "Monto",
        "recurring.col.status": "Estado",
        "recurring.col.action": "Acción",

        // Recurring page — frequency labels
        "recurring.freq.weekly": "Semanal",
        "recurring.freq.biweekly": "Quincenal",
        "recurring.freq.monthly": "Mensual",
        "recurring.freq.quarterly": "Trimestral",
        "recurring.freq.yearly": "Anual",

        // Recurring page — status + actions
        "recurring.status.pending": "Pendiente",
        "recurring.status.paid": "Pagado",
        "recurring.status.received": "Recibido",
        "recurring.action.mark_paid": "Marcar como pagado",
        "recurring.action.mark_received": "Marcar como recibido",
        "recurring.action.not_due_yet": "Aún no vence",
        "recurring.action.saving": "Guardando…",

        // Recurring page — due labels
        "recurring.due.overdue": "Vencido",
        "recurring.due.today": "Hoy",
        "recurring.due.tomorrow": "Mañana",
        "recurring.due.days_left.one": "1 día restante",
        "recurring.due.days_left.many": "{n} días restantes",

        // Recurring page — empty state
        "recurring.empty.title": "Sin pagos recurrentes",
        "recurring.empty.text": "Agrega una renta, salario, suscripción o cualquier pago que se repita.",

        // Recurring page — Detected Subscriptions card
        "recurring.detected_subs": "Suscripciones detectadas",
        "recurring.subs.scanning": "Analizando tus transacciones…",
        "recurring.subs.loading": "Buscando cargos recurrentes del mismo monto en los últimos 6 meses…",
        "recurring.subs.active": "Activas",
        "recurring.subs.monthly_total": "Total mensual",
        "recurring.subs.possibly_unused": "Posiblemente sin uso",
        "recurring.subs.summary_mode.ai": "Resumen IA",
        "recurring.subs.summary_mode.cached": "Resumen en caché",
        "recurring.subs.summary_mode.rule": "Resumen heurístico",
        "recurring.subs.summary_mode.empty": "Sin coincidencias",
        "recurring.subs.empty_list": "No se detectaron cargos recurrentes. Importa más transacciones o espera al próximo ciclo de facturación.",
        "recurring.subs.fetch_error": "No se pudieron analizar las suscripciones en este momento. Inténtalo de nuevo.",
        "recurring.subs.add_failed": "No se pudo agregar a pagos recurrentes",
        "recurring.subs.tracked_toast": "{name} agregado a pagos recurrentes",

        // Recurring page — subscription item meta
        "recurring.subs.charge.one": "1 cargo",
        "recurring.subs.charge.many": "{n} cargos",
        "recurring.subs.charged_today": "cobrado hoy",
        "recurring.subs.last_charged.one": "último cargo hace 1 día",
        "recurring.subs.last_charged.many": "último cargo hace {n} días",
        "recurring.subs.meta_join": " · ",
        "recurring.subs.track_btn": "Agregar a recurrentes",
        "recurring.subs.tracked_btn": "Ya sigue",
        "recurring.subs.adding_btn": "Agregando…",
        "recurring.subs.added_btn": "Siguiendo",

        // Recurring modal
        "recurring.modal.add_title": "Agregar pago recurrente",
        "recurring.modal.edit_title": "Editar pago recurrente",
        "recurring.modal.desc": "Agrega un ingreso o factura recurrente a tu pronóstico.",
        "recurring.modal.name": "Nombre",
        "recurring.modal.name_placeholder": "p. ej. Renta, Netflix, Salario",
        "recurring.modal.amount": "Monto",
        "recurring.modal.amount_placeholder": "p. ej. 1500",
        "recurring.modal.type": "Tipo",
        "recurring.modal.expense": "Gasto",
        "recurring.modal.income": "Ingreso",
        "recurring.modal.category": "Categoría",
        "recurring.modal.select_category": "Elegir una categoría",
        "recurring.modal.add": "Agregar",
        "recurring.modal.account": "Cuenta",
        "recurring.modal.account_placeholder": "p. ej. Cuenta corriente, Alipay",
        "recurring.modal.frequency": "Frecuencia",
        "recurring.modal.next_date": "Próxima fecha",
        "recurring.modal.cancel": "Cancelar",
        "recurring.modal.save": "Guardar",
        "recurring.modal.update": "Actualizar",

        // Money Coach — stat cards
        "coach.stat.snapshot": "Resumen del día",
        "coach.stat.snapshot_value": "Resumen",
        "coach.stat.snapshot_note": "Análisis de tus datos más recientes",
        "coach.stat.top_pressure": "Mayor presión de gasto",
        "coach.stat.top_pressure_note": "Identificación del rubro de gasto principal",
        "coach.stat.safe_to_spend": "Disponible esta semana",
        "coach.stat.safe_to_spend_note": "Después de presupuestos, facturas y metas.",
        "coach.stat.loading": "Cargando",

        // Money Coach — Brief
        "coach.brief.title": "El informe del Coach",
        "coach.brief.kicker": "En vivo desde tus datos",
        "coach.brief.headline": "Así están tus finanzas hoy.",
        "coach.brief.summary": "FinTrack analiza tus transacciones, presupuestos, metas y pagos recurrentes para darte una vista clara.",
        "coach.brief.biggest": "Mayor presión de gasto",
        "coach.brief.biggest_loading": "Buscando la señal de gasto más importante.",
        "coach.brief.best_move": "Mejor acción a tomar",
        "coach.brief.best_move_default": "Pregúntale al Coach antes de cualquier decisión importante — revisará tus números reales.",
        "coach.brief.sees": "Lo que el Coach puede ver",

        // Money Coach — data pills
        "coach.data.transactions": "Transacciones",
        "coach.data.budgets": "Presupuestos",
        "coach.data.goals": "Metas",
        "coach.data.recurring": "Recurrentes",
        "coach.data.investments": "Resumen de inversiones",

        // Money Coach — Saved insights & history
        "coach.saved.title": "Insights guardados",
        "coach.saved.count_zero": "0 abiertos",
        "coach.saved.count_one": "1 abierto",
        "coach.saved.count_many": "{n} abiertos",
        "coach.saved.empty": "Los insights importantes del Coach permanecerán aquí hasta que los resuelvas.",
        "coach.saved.empty_none": "No hay insights guardados que necesiten tu atención.",
        "coach.saved.resolve": "Marcar como resuelto",
        "coach.saved.fallback_title": "Insight guardado",
        "coach.history.title": "Historial reciente",
        "coach.history.count_zero": "0 guardados",
        "coach.history.count_one": "1 guardado",
        "coach.history.count_many": "{n} guardados",
        "coach.history.empty": "Pregúntale al Coach para empezar tu historial.",

        // Money Coach — Ask card
        "coach.ask.title": "Pregúntale al Coach",
        "coach.ask.subtitle": "Haz una pregunta concreta. El Coach revisa tus datos de FinTrack antes de responder.",
        "coach.ask.try_one": "Prueba con una de estas preguntas",
        "coach.ask.placeholder": "Ej.: ¿Puedo gastar 100 € esta semana sin riesgo?",
        "coach.ask.send": "Preguntar al Coach",
        "coach.ask.thinking": "Pensando…",
        "coach.ask.powered_by": "Impulsado por Claude",
        "coach.ask.status_ready": "Coach listo",
        "coach.ask.status_thinking": "El Coach está pensando…",
        "coach.ask.status_streaming": "El Coach responde…",
        "coach.ask.status_local": "Guía local",
        "coach.ask.status_retry": "Reintentar",
        "coach.ask.empty_warning": "Primero hazle una pregunta al Coach",
        "coach.ask.failed": "El Coach falló",
        "coach.ask.error": "El Coach no puede responder por ahora",

        // Money Coach — starter chips
        "coach.starter.afford": "¿Puedo permitírmelo?",
        "coach.starter.cut": "¿Qué debería reducir esta semana?",
        "coach.starter.bill": "¿Qué factura me cuesta más?",
        "coach.starter.payday": "¿Estoy seguro hasta el día de pago?",

        // Money Coach — response card
        "coach.response.badge": "Coach Financiero",
        "coach.response.used": "Datos utilizados",
        "coach.response.helpful": "¿Te ayudó esta respuesta?",
        "coach.response.helpful_yes": "Útil",
        "coach.response.helpful_no": "No fue útil",
        "coach.response.guidance": "Solo guía educativa, no es asesoramiento financiero.",

        // Money Coach — structured answer
        "coach.answer.label_main": "Coach Financiero",
        "coach.answer.short": "Respuesta corta",
        "coach.answer.why": "Por qué",
        "coach.answer.next": "Acción recomendada",
        "coach.verdict.yes": "SÍ",
        "coach.verdict.no": "NO",
        "coach.verdict.wait": "ESPERAR",

        // Money Coach — dynamic stat cards
        "coach.read.good": "Todo bien",
        "coach.read.focus": "Requiere atención",
        "coach.read.review": "Para revisar",
        "coach.read.none": "No se detecta presión importante",
        "coach.read.over_budget": "{category} excede su presupuesto",
        "coach.read.bill_soon": "{name} llega pronto",
        "coach.read.month_negative": "El mes está en negativo",
        "coach.read.goals_active": "Tus metas están activas",

        "coach.pressure.none": "Ninguna",
        "coach.pressure.none_note": "Sin presión urgente detectada",
        "coach.pressure.none_text": "Ninguna categoría o factura destaca como urgente.",
        "coach.pressure.over_amount": "{amount} excedidos",
        "coach.pressure.over_text": "{category} es la presión más clara — su presupuesto está rebasado.",
        "coach.pressure.due_soon_amount": "{amount} por pagar pronto",
        "coach.pressure.bill_text": "{name} es el próximo gasto recurrente.",
        "coach.pressure.cash_flow": "Flujo de caja",
        "coach.pressure.net_month": "{amount} neto este mes",
        "coach.pressure.overspend_text": "Tus gastos mensuales superan actualmente tus ingresos.",
        "coach.pressure.left": "Restan {amount}",
        "coach.pressure.goal_text": "{name} es tu meta activa más cercana.",

        // Money Coach — safe to spend
        "coach.safe.after": "Después de presupuestos, facturas y metas.",
        "coach.safe.fix_first": "Atiende primero la categoría excedida",
        "coach.safe.bill_room": "Reserva margen para las facturas próximas",
        "coach.safe.fix_net": "Lleva el saldo mensual por encima de cero",
        "coach.safe.still_protect": "Sigue protegiendo tu meta",
        "coach.safe.goal_tight": "El margen para la meta está ajustado",
        "coach.safe.needs_data_note": "Agrega transacciones, presupuestos, facturas o metas para afinar este número.",
        "coach.safe.status.needs_data": "Datos insuficientes",
        "coach.safe.status.wait": "Esperar",
        "coach.safe.status.careful": "Cuidado",
        "coach.safe.status.looks_safe": "Todo en orden",

        // Money Coach — brief titles & summaries
        "coach.brief.title_steady": "Tus finanzas están estables",
        "coach.brief.summary_steady": "Tus datos actuales no muestran ninguna alerta importante. Verifica antes de compras grandes.",
        "coach.brief.title_attention": "Tu presupuesto necesita tu atención",
        "coach.brief.summary_attention": "{category} excede por {amount}. Pausa los gastos adicionales antes de cualquier compra nueva.",
        "coach.brief.title_bill": "Una factura llega pronto",
        "coach.brief.summary_bill": "{name} vence {when}. Reserva margen antes de gastar más.",
        "coach.brief.title_overspend": "Los gastos superan los ingresos",
        "coach.brief.summary_overspend": "El mes está actualmente en {amount} después de ingresos y gastos.",
        "coach.brief.title_protect_goal": "Protege tu próxima meta",
        "coach.brief.summary_goal": "{name} aún necesita {amount}. Evita que gastos extra la frenen.",

        // Money Coach — best next move
        "coach.move.steady": "Mantén tus gastos habituales y revisa antes de compras grandes.",
        "coach.move.pause_category": "Pausa los gastos en {category} y pregúntale al Coach antes de cualquier compra opcional.",
        "coach.move.reserve_bill": "Mantén al menos {amount} disponibles para {name}.",
        "coach.move.cut_flex": "Reduce un gasto flexible antes de comprometer dinero nuevo.",
        "coach.move.toward_goal": "Mueve una pequeña cantidad hacia {name} antes de cualquier gasto opcional.",

        // Money Coach — due labels
        "coach.due.today": "hoy",
        "coach.due.one_day": "en 1 día",
        "coach.due.n_days": "en {n} días",

        // Money Coach — Ask card extra statuses
        "coach.ask.status_saved": "Respuesta guardada",
        "coach.ask.status_saved_local": "Guía local guardada",

        // Money Coach — data-used pills
        "coach.data.count_one": "1 elemento",
        "coach.data.count_many": "{n} elementos",

        // Receipt scan
        "receipt.scan_btn": "Escanear un recibo",
        "receipt.fab": "Escanear un recibo",
        "receipt.badge_ai": "IA",
        "receipt.modal.title": "Escanear un recibo",
        "receipt.modal.desc": "Toma una foto o sube una imagen. La IA lee el comercio, el monto, la fecha y la categoría — tú confirmas.",
        "receipt.dropzone.title": "Fotografía o suelta tu recibo",
        "receipt.dropzone.sub": "JPG, PNG, WEBP o HEIC · hasta 8 MB",
        "receipt.tip": "En móvil, elige una foto de tu galería o haz una nueva. En computadora, puedes soltar una imagen aquí.",
        "receipt.scan.reading": "Leyendo tu recibo…",
        "receipt.field.merchant": "Comercio",
        "receipt.field.amount": "Monto",
        "receipt.field.currency": "Moneda",
        "receipt.field.date": "Fecha",
        "receipt.field.category": "Categoría",
        "receipt.field.account": "Cuenta",
        "receipt.field.type": "Tipo",
        "receipt.confidence.high": "Confianza alta",
        "receipt.confidence.medium": "Confianza media",
        "receipt.confidence.low": "Confianza baja — verifica bien",
        "receipt.error.title": "No pudimos leer este recibo",
        "receipt.error.msg": "Intenta con una foto más nítida o introduce los detalles manualmente.",
        "receipt.error.network": "Error de red. Verifica tu conexión e inténtalo de nuevo.",
        "receipt.error.type": "Tipo de imagen no compatible. Usa JPG, PNG, WEBP o HEIC.",
        "receipt.error.too_big": "La imagen es demasiado grande (máx. 8 MB).",
        "receipt.error.fields": "Por favor completa el comercio, el monto y la fecha.",
        "receipt.error.save": "No se pudo guardar la transacción",
        "receipt.duplicate.confirm": "Este recibo ya fue escaneado el {date}. ¿Quieres escanearlo de nuevo?",
        "receipt.duplicate.cancelled": "Escaneo cancelado — este recibo ya fue escaneado.",
        "receipt.duplicate.title": "Recibo ya escaneado",
        "receipt.duplicate.body": "Este recibo ya fue escaneado el {date}. Puedes elegir otra foto o escanearlo de nuevo.",
        "receipt.duplicate.cancel": "Elegir otra foto",
        "receipt.duplicate.continue": "Escanear de nuevo",
        "receipt.retry": "Probar con otra foto",
        "receipt.manual": "Ingresar manualmente",
        "receipt.save": "Guardar transacción",
        "receipt.saving": "Guardando…",
        "receipt.toast_saved": "Transacción guardada desde el recibo",

        // Cash flow forecast
        "cashflow.title": "Pronóstico de flujo de caja",
        "cashflow.whatif_btn": "Probar una compra",
        "cashflow.whatif_sub": "Ve si encaja en tus próximos 30 días",
        "cashflow.loading_kicker": "Leyendo tus datos…",
        "cashflow.loading_text": "Construyendo los próximos 30 días.",
        "cashflow.error": "No se pudo cargar el pronóstico. Inténtalo de nuevo.",
        "billing.trial_expired_kicker": "Prueba terminada",
        "billing.trial_expired": "Tu prueba terminó. Suscríbete para seguir usando el pronóstico.",
        "cashflow.kicker.good": "Todo bien",
        "cashflow.kicker.warn": "Margen ajustado",
        "cashflow.kicker.danger": "Alerta",
        "cashflow.headline.good": "Tendrás alrededor de {amount} disponibles en 30 días.",
        "cashflow.headline.tight": "Tu punto más bajo es {amount} el {date} — limita los gastos extra hasta entonces.",
        "cashflow.headline.zero": "Corres el riesgo de quedar en descubierto el {date}.",
        "cashflow.today": "Hoy",
        "cashflow.lowest": "Punto más bajo",
        "cashflow.end_of_window": "En 30 días",

        // What-if simulator
        "whatif.modal.title": "¿Y si compras esto?",
        "whatif.modal.desc": "Planifica una compra y mira su impacto en tu flujo de caja de los próximos 30 días.",
        "whatif.field.amount": "Monto",
        "whatif.field.amount_placeholder": "p. ej. 1500",
        "whatif.field.label": "¿Qué es?",
        "whatif.field.label_placeholder": "Celular nuevo, fin de semana…",
        "whatif.field.when": "¿Cuándo?",
        "whatif.field.category": "Categoría (opcional)",
        "whatif.field.category_placeholder": "Compras, Viaje…",
        "whatif.run": "Ver el impacto",
        "whatif.simulating": "Simulando…",
        "whatif.verdict.yes": "Sí, puedes",
        "whatif.verdict.wait": "Espera",
        "whatif.verdict.no": "Aún no",
        "whatif.reason.yes": "Después de esta compra, te quedarían alrededor de {end} a fin de mes.",
        "whatif.reason.wait": "Te quedarían alrededor de {min} en el punto más bajo. Espera después del próximo pago para tener un margen cómodo.",
        "whatif.reason.no": "Esto te dejaría en descubierto cerca del {date}.",
        "whatif.impact.end": "En 30 días",
        "whatif.impact.min": "Punto más bajo",
        "whatif.error.amount": "Ingresa un monto para simular.",
        "whatif.error.failed": "No se pudo ejecutar la simulación",

        // Money Coach — empty states
        "coach.history.empty_title": "Aún no hay preguntas",
        "coach.saved.empty_title": "Todo en orden",

        // Category picker modal
        "category_picker.title": "Elegir una categoría",
        "category_picker.desc": "Selecciona una categoría para {ctx}.",
        "category_picker.ctx.transaction": "esta transacción",
        "category_picker.ctx.budget": "este presupuesto",
        "category_picker.ctx.recurring": "este pago recurrente",
        "category_picker.ctx.goal": "esta meta",
        "category_picker.ctx.default": "este elemento",

        // Time
        "time.today": "hoy",
        "time.yesterday": "ayer",

        // Transactions page — top bar
        "tx.all_transactions": "Todas las transacciones",
        "tx.export": "Exportar",
        "tx.delete_all": "Eliminar todo",
        "tx.add_transaction": "Agregar transacción",

        // Transactions page — summary cards
        "tx.visible_income": "Ingresos visibles",
        "tx.visible_expenses": "Gastos visibles",
        "tx.visible_net": "Saldo neto visible",
        "tx.activity": "Actividad",
        "tx.no_visible": "0 transacciones visibles",
        "tx.visible_count.one": "{n} transacción visible",
        "tx.visible_count.other": "{n} transacciones visibles",

        // Transactions page — filters
        "tx.search_placeholder": "Buscar transacciones, categorías, cuentas…",
        "tx.all_types": "Todos los tipos",
        "tx.income": "Ingreso",
        "tx.expense": "Gasto",
        "tx.all_categories": "Todas las categorías",
        "tx.clear_filters": "Limpiar filtros",
        "tx.more_filters": "Más filtros",
        "tx.filter_by_category": "Filtrar por categoría",
        "tx.filter_by_category_desc": "Elige una categoría para filtrar tus transacciones.",
        "tx.search_categories": "Buscar categorías…",
        "tx.advanced_filters": "Filtros avanzados",
        "tx.clear_all": "Limpiar todo",
        "tx.account": "Cuenta",
        "tx.all_accounts": "Todas las cuentas",
        "tx.sort_by": "Ordenar por",
        "tx.sort.newest": "Más reciente",
        "tx.sort.oldest": "Más antiguo",
        "tx.sort.highest": "Mayor monto",
        "tx.sort.lowest": "Menor monto",
        "tx.sort.name_az": "Nombre A–Z",
        "tx.sort.name_za": "Nombre Z–A",
        "tx.from_date": "Fecha de inicio",
        "tx.to_date": "Fecha de fin",

        // Transactions page — table & pagination
        "tx.col.transaction": "Transacción",
        "tx.col.type": "Tipo",
        "tx.col.category": "Categoría",
        "tx.col.account": "Cuenta",
        "tx.col.date": "Fecha",
        "tx.col.amount": "Monto",
        "tx.edit_tooltip": "Editar transacción",
        "tx.delete_tooltip": "Eliminar transacción",
        "tx.pagination.showing": "Mostrando {from}–{to} de {total} transacciones",
        "tx.previous": "← Anterior",
        "tx.next": "Siguiente →",
        "tx.empty.no_match.title": "Sin transacciones coincidentes",
        "tx.empty.no_match.text": "Prueba a ajustar tus filtros o restablécelos para ver más resultados.",
        "tx.empty.no_tx.title": "Aún no hay transacciones",
        "tx.empty.no_tx.text": "Empieza por agregar tu primera transacción o por importar un archivo CSV.",
        "tx.no_categories_found": "No se encontraron categorías.",

        // Default categories
        "category.income": "Ingreso",
        "category.groceries": "Supermercado",
        "category.entertainment": "Entretenimiento",
        "category.transport": "Transporte",
        "category.utilities": "Servicios públicos",
        "category.housing": "Vivienda",
        "category.dining": "Restaurantes",
        "category.health": "Salud",
        "category.shopping": "Compras",
        "category.other": "Otro",

        // Budgets page — stats
        "budgets.total_budget": "Presupuesto total",
        "budgets.total_spent": "Total gastado",
        "budgets.remaining": "Restante",
        "budgets.overspent_categories": "Categorías excedidas",
        "budgets.overspent_desc": "Gastos por encima de los presupuestos por categoría",

        // Budgets page — section header
        "budgets.flexible_budgets": "Presupuestos flexibles",
        "budgets.create_budget": "+ Crear presupuesto",

        // Budgets — AI-suggested budgets
        "budgets.suggestions.title": "Presupuestos sugeridos",
        "budgets.suggestions.subtitle": "Basado en tus últimos 90 días",
        "budgets.suggestions.window_90": "Basado en tus últimos 90 días",
        "budgets.suggestions.window_partial": "Basado en tus últimos {n} días",
        "budgets.suggestions.desc": "Calculamos lo que gastas realmente por categoría. Haz clic en una sugerencia para crear ese presupuesto en un solo clic — puedes ajustarlo antes de guardar.",
        "budgets.suggestions.tooltip": "Promedio de 90 días: {avg}",

        // Budgets — pace projection on each card
        "budgets.pace.overrun": "Al ritmo actual: {projected} a fin de mes · excederás el {date}",
        "budgets.pace.on_track": "Al ritmo actual: {projected} a fin de mes · dentro del presupuesto",

        // Budgets — misc
        "budgets.per_month_suffix": "/mes",
        "budgets.income_hidden.one": "1 meta de ingreso está oculta aquí — sigue tus ingresos en Pagos recurrentes.",
        "budgets.income_hidden.many": "{n} metas de ingreso están ocultas aquí — sigue tus ingresos en Pagos recurrentes.",

        // Budgets page — demo card labels
        "budgets.demo.dining_out": "Restaurantes",
        "budgets.demo.transportation": "Transporte",
        "budgets.transactions": "transacciones",
        "budgets.of": "de",
        "budgets.left": "restante",
        "budgets.vs_last_month": "vs mes pasado",
        "budgets.no_change": "Sin cambios",

        // Budgets page — dynamic JS strings
        "budgets.empty.title": "Aún no hay presupuestos",
        "budgets.empty.text": "Crea un presupuesto para seguir tus gastos por categoría.",
        "budgets.uncategorized": "Sin categoría",
        "budgets.budget_suffix": "de presupuesto",
        "budgets.used": "usado",
        "budgets.days.suffix": "días",
        "budgets.days.ended": "Terminado",
        "budgets.days.ends_today": "Termina hoy",
        "budgets.days.one_left": "1 día restante",
        "budgets.days.n_left": "{n} días restantes",
        "budgets.status.over": "Excedido",
        "budgets.status.at_limit": "En el límite",
        "budgets.status.near": "Cerca del límite",
        "budgets.status.on_track": "En orden",
        "budgets.source.one": "Calculado con {n} transacción",
        "budgets.source.other": "Calculado con {n} transacciones",

        // Budgets — modal
        "budgets.modal.create_title": "Crear un presupuesto",
        "budgets.modal.edit_title": "Editar presupuesto",
        "budgets.modal.desc": "Crea un presupuesto para una categoría y un rango de fechas.",
        "budgets.modal.category": "Categoría",
        "budgets.modal.select_category": "Elegir una categoría",
        "budgets.modal.add": "Agregar",
        "budgets.modal.amount": "Monto",
        "budgets.modal.amount_placeholder": "p. ej. 500",
        "budgets.modal.start_date": "Fecha de inicio",
        "budgets.modal.end_date": "Fecha de fin",
        "budgets.modal.length": "Duración del presupuesto",
        "budgets.modal.length_placeholder": "p. ej. 7",
        "budgets.modal.quick_duration": "Duración rápida",
        "budgets.modal.quick_duration_hint": "Opcional. Elige un valor para completar la fecha de fin, o Ninguno y usa tu propia fecha.",
        "budgets.modal.duration_none": "Ninguno",
        "budgets.modal.weekly": "Semanal",
        "budgets.modal.two_weeks": "2 semanas",
        "budgets.modal.monthly": "Mensual",
        "budgets.modal.quarterly": "Trimestral",
        "budgets.modal.tracking_rule": "Regla de seguimiento",
        "budgets.modal.category_only": "Solo categoría",
        "budgets.modal.category_keyword": "Categoría + palabra clave",
        "budgets.modal.keyword": "Palabra clave",
        "budgets.modal.keyword_placeholder": "p. ej. tailandia, computadora, boda",
        "budgets.modal.keyword_hint": "Usa esto cuando un presupuesto también deba incluir transacciones cuyo nombre contenga esa palabra.",
        "budgets.modal.delete": "Eliminar presupuesto",
        "budgets.modal.view_matched": "Ver transacciones coincidentes",
        "budgets.modal.save_budget": "Guardar presupuesto",

        // Common
        "common.cancel": "Cancelar",
        "common.on": "ACTIVADO",
        "common.off": "DESACTIVADO",

        // Goals — stats
        "goals.total_saved": "Total ahorrado",
        "goals.target_total": "Objetivo total",
        "goals.completed": "Metas alcanzadas",
        "goals.plan": "Plan de metas",
        "goals.plan_desc": "Sigue lo que ahorras, dónde estás y qué merece tu atención.",
        "goals.note.across_active": "Entre las metas activas",
        "goals.note.build_plan": "Construye tu plan",
        "goals.note.across_one": "Entre {n} meta",
        "goals.note.across_other": "Entre {n} metas",
        "goals.note.pct_complete": "{pct} % alcanzado",
        "goals.note.nice_progress": "Buen avance",
        "goals.note.keep_going": "Sigue así",

        // Goals — status & details
        "goals.status.completed": "Alcanzada",
        "goals.status.no_timeline": "Sin plazo",
        "goals.status.missed": "Plazo vencido",
        "goals.status.needs_attention": "Requiere atención",
        "goals.status.on_track": "En orden",
        "goals.status.behind": "Atrasada",
        "goals.status.ahead": "Adelantada",
        "goals.detail.target_reached": "Meta alcanzada",
        "goals.detail.add_date": "Agrega una fecha objetivo",
        "goals.detail.left_after": "Quedan {amount} después del {date}",
        "goals.detail.left_by": "Quedan {amount} antes del {date}",
        "goals.detail.left": "Quedan {amount}",

        // Goals — dates & reminders
        "goals.target": "Objetivo:",
        "goals.no_target_date": "Sin fecha objetivo",
        "goals.days.one_overdue": "1 día de retraso",
        "goals.days.n_overdue": "{n} días de retraso",
        "goals.days.due_today": "vence hoy",
        "goals.days.one_left": "1 día restante",
        "goals.days.n_left": "{n} días restantes",
        "goals.reminder.no_savings": "No has agregado ahorros a esta meta en {n} días",
        "goals.reminder.no_recent": "No has alimentado esta meta en {n} días",

        // Goals — card content
        "goals.default_category": "Ahorros",
        "goals.untitled": "Meta sin nombre",
        "goals.saved": "Ahorrado",
        "goals.added": "agregados",
        "goals.complete": "alcanzado",
        "goals.to_go": "restantes",
        "goals.save_monthly": "Ahorra {amount}/mes para alcanzar la meta",
        "goals.this_goal": "esta meta",

        // Goals — auto savings
        "goals.auto_savings": "Ahorro automático",
        "goals.auto.includes": "Incluye el ahorro automático",
        "goals.auto.watching": "El ahorro automático vigila {cat}",
        "goals.auto.off": "Ahorro automático desactivado",
        "goals.auto.detail_on": "FinTrack agrega automáticamente a esta meta las transacciones de ahorro de la categoría {cat}.",
        "goals.auto.detail_off": "El ahorro automático está desactivado para {cat}. Actívalo para incluir las transacciones de ahorro coincidentes.",
        "goals.auto_for": "Ahorro automático para {cat}",
        "goals.turn_on": "Activar",
        "goals.turn_off": "Desactivar",
        "goals.turning_on": "Activando…",
        "goals.turning_off": "Desactivando…",
        "goals.toast.auto_on": "Ahorro automático activado para {cat}",
        "goals.toast.auto_off": "Ahorro automático desactivado para {cat}",
        "goals.toast.auto_error": "No se pudo actualizar el ahorro automático",

        // Goals — breakdown / details
        "goals.view_details": "Ver detalles",
        "goals.hide_details": "Ocultar detalles",
        "goals.savings_details": "Detalles del ahorro",
        "goals.you_added": "Tus aportes",
        "goals.auto_added": "Aportes automáticos",
        "goals.history": "Historial",
        "goals.history_hint": "Abre los detalles para cargar el historial.",
        "goals.coach_suggestions": "Sugerencias del Coach Financiero",
        "goals.coach_hint": "Abre los detalles para cargar las sugerencias del Coach Financiero.",
        "goals.add_savings": "+ Agregar ahorro",
        "goals.edit_tooltip": "Editar meta",
        "goals.delete_tooltip": "Eliminar meta",
        "goals.empty.title": "Aún no hay metas",
        "goals.empty.text": "Crea tu primera meta y FinTrack seguirá tu progreso aquí.",

        // Dynamic search placeholders
        "topnav.search_budgets": "Buscar presupuestos…",
        "topnav.search_goals": "Buscar metas…",
        "topnav.search_investments": "Buscar inversiones…",
        "topnav.search_default": "Buscar…",

        // Goals — Edit/Create modal
        "goals.modal.create_title": "Crear una meta",
        "goals.modal.edit_title": "Editar meta",
        "goals.modal.create_desc": "Crea una nueva meta de ahorro y sigue tu progreso.",
        "goals.modal.edit_desc": "Actualiza esta meta y mantén tu plan de ahorro al día.",
        "goals.modal.name": "Nombre de la meta",
        "goals.modal.name_placeholder": "p. ej. Viaje de ensueño",
        "goals.modal.target_amount": "Monto objetivo",
        "goals.modal.target_placeholder": "p. ej. 5000",
        "goals.modal.current_saved": "Ya ahorrado",
        "goals.modal.saved_placeholder": "p. ej. 1200",
        "goals.modal.target_date": "Fecha objetivo",
        "goals.modal.auto_savings": "Ahorro automático",
        "goals.modal.auto_can": "FinTrack puede agregar automáticamente los ahorros correspondientes a esta meta.",
        "goals.modal.auto_does": "FinTrack agrega automáticamente los ahorros correspondientes a esta meta.",
        "goals.modal.save_goal": "Guardar meta",

        // Goals — Add Savings (contribution) modal
        "goals.contrib.title": "Agregar ahorro",
        "goals.contrib.desc": "Agrega ahorro para esta meta.",
        "goals.contrib.desc_for": "Agrega ahorro para {goal}.",
        "goals.contrib.amount_placeholder": "p. ej. 250",
        "goals.contrib.date": "Fecha",
        "goals.contrib.note": "Nota",
        "goals.contrib.note_placeholder": "Opcional",
        "goals.add_savings_btn": "Agregar ahorro",
        "goals.toast.savings_added": "Ahorro agregado",
        "goals.toast.savings_error": "No se pudo agregar el ahorro",

        // Goals — savings history
        "goals.history.loading": "Cargando historial…",
        "goals.history.error": "Error al cargar el historial",
        "goals.history.empty": "Aún no hay historial de ahorro. Tus aportes manuales y las transacciones de ahorro coincidentes aparecerán aquí.",
        "goals.history.could_not_load": "No se pudo cargar el historial.",
        "goals.history.source.auto": "Agregado automáticamente desde una transacción",
        "goals.history.source.manual": "Aporte manual",
        "goals.history.note.matched": "Transacción de ahorro coincidente",
        "goals.history.note.manual": "Ahorro manual",

        // Goals — Money Coach suggestions
        "goals.sugg.empty": "Aún no hay sugerencias disponibles.",
        "goals.sugg.smart_move": "Buena idea",
        "goals.sugg.loading": "El Coach Financiero está analizando esta meta…",
        "goals.sugg.error": "Error al cargar las sugerencias",
        "goals.sugg.this_category": "esta categoría",
        "goals.sugg.add_context.title": "Agregar contexto",
        "goals.sugg.add_context.action": "Agrega algunas transacciones recientes para que el Coach Financiero pueda identificar oportunidades reales de ahorro.",
        "goals.sugg.add_context.why": "Mejores datos transforman este consejo genérico en un plan personalizado.",
        "goals.sugg.complete.title": "Meta alcanzada",
        "goals.sugg.complete.action": "Dirige los nuevos ahorros a tu próxima prioridad en lugar de dejar ese dinero sin uso.",
        "goals.sugg.complete.why": "Una meta alcanzada debería alimentar automáticamente el impulso de la siguiente.",
        "goals.sugg.week.title": "Esta semana",
        "goals.sugg.week.action": "Transfiere {amount} a esta meta esta semana en lugar de esperar al final del mes.",
        "goals.sugg.week.why": "Transferencias semanales más pequeñas hacen que la meta sea más fácil y reducen la presión de último minuto.",
        "goals.sugg.tradeoff.title": "Compromiso a probar",
        "goals.sugg.tradeoff.action": "Elige una compra flexible en {cat} y redirígela a la meta.",
        "goals.sugg.tradeoff.why": "Incluso un solo gasto evitado puede hacer que {goal} se sienta activa en lugar de lejana.",
        "goals.sugg.auto.title": "Hazlo automático",
        "goals.sugg.auto.action_on": "Verifica el monto agregado automáticamente después de tu próxima transacción de ahorro y retíralo si corresponde a la categoría equivocada.",
        "goals.sugg.auto.action_off": "Activa el ahorro automático para esta meta y los ahorros coincidentes se agregarán sin esfuerzo.",
        "goals.sugg.auto.why": "La automatización ayuda a que la meta avance incluso cuando olvidas actualizarla manualmente.",

        // CSV upload modal
        "csv.modal.title": "Importar CSV",
        "csv.modal.desc": "Sube tu extracto bancario CSV de WeChat Pay, Alipay o cualquier banco.",
        "csv.dropzone.title": "Arrastra y suelta tu CSV aquí",
        "csv.dropzone.or_prefix": "o",
        "csv.dropzone.browse": "buscar archivos",
        "csv.status_ready": "Elige un archivo CSV y luego haz clic en Subir e importar.",
        "csv.upload_btn": "Subir e importar",

        // Add/Edit Transaction modal
        "tx.modal.add_title": "Agregar transacción",
        "tx.modal.edit_title": "Editar transacción",
        "tx.modal.desc": "Agrega un nuevo ingreso o gasto manualmente.",
        "tx.modal.edit_desc": "Actualiza los detalles de esta transacción.",
        "tx.modal.name": "Nombre",
        "tx.modal.name_placeholder": "p. ej. Salario, Uber, Supermercado",
        "tx.modal.amount": "Monto",
        "tx.modal.amount_placeholder": "p. ej. 120.50",
        "tx.modal.type": "Tipo",
        "tx.modal.select_account": "Elegir cuenta",
        "tx.modal.save": "Guardar transacción",
        "tx.modal.save_changes": "Guardar cambios",

        // Account options
        "account.cash": "Efectivo",
        "account.investment": "Inversión",
        "account.bank_import": "Importación bancaria",

        // Quick Add Category modal
        "cat_quick.title": "Agregar categoría",
        "cat_quick.desc": "Crea una nueva categoría sin salir de tu formulario de transacción.",
        "cat_quick.name": "Nombre de la categoría",
        "cat_quick.name_placeholder": "p. ej. Café, Gasolina, Regalos",
        "cat_quick.icon": "Ícono de categoría",
        "cat_quick.choose_icon": "Elegir ícono",
        "cat_quick.save": "Guardar categoría",

        // Category Icon Picker modal
        "icon_picker.title": "Elegir ícono de categoría",
        "icon_picker.desc": "Selecciona un ícono para esta categoría o usa tu propio emoji.",
        "icon_picker.selected": "Ícono seleccionado",
        "icon_picker.search": "Buscar íconos…",
        "icon_picker.own_emoji": "Usa tu propio emoji",
        "icon_picker.paste_emoji": "Pega cualquier emoji",
        "icon_picker.use": "Usar",
        "icon_picker.popular": "Populares",
        "icon_picker.all": "Todos los íconos",

        // Delete confirmation modals
        "delete.goal.title": "Eliminar meta",
        "delete.goal.desc": "¿Estás seguro de que quieres eliminar esta meta? Tu progreso guardado para esta meta se eliminará de este plan.",
        "delete.tx.title": "Eliminar transacción",
        "delete.tx.desc": "¿Estás seguro de que quieres eliminar esta transacción? Esta acción no se puede deshacer.",
        "delete.tx_all.title": "Eliminar todas las transacciones",
        "delete.tx_all.desc": "¿Estás seguro de que quieres eliminar todas las transacciones? Esta acción no se puede deshacer.",
        "delete.tx_all.confirm": "Eliminar todo",
        "delete.budget.title": "Eliminar presupuesto",
        "delete.budget.desc": "¿Estás seguro de que quieres eliminar este presupuesto? Esta acción no se puede deshacer.",
        "delete.recurring.title": "Eliminar pago recurrente",
        "delete.recurring.desc": "¿Estás seguro de que quieres eliminar este pago recurrente? Se eliminará de tu pronóstico.",

        // Common
        "common.delete": "Eliminar",
        "common.got_it": "Entendido",

        // Investments — preview & coming-soon
        "invest.preview.title": "Vista previa de Inversiones",
        "invest.preview.kicker": "Próximamente",
        "invest.preview.hero_title": "La inteligencia de inversiones está en vista previa",
        "invest.preview.hero_text": "Puedes explorar la página de Inversiones ahora, pero algunos análisis de mercado aún usan cálculos de demostración hasta que se conecten las API de datos de producción.",
        "invest.preview.avail": "Disponible en vista previa",
        "invest.preview.avail_text": "Tarjetas de cartera, asignación, gráficos, posiciones, reportes y guía.",
        "invest.preview.prep": "Aún en preparación",
        "invest.preview.prep_text": "Sincronización en vivo con corredor, lotes fiscales, dividendos, noticias y datos de analistas.",
        "invest.preview.stay": "Quedarme aquí",
        "invest.preview.continue": "Vista previa de Inversiones",
        "invest.add.title": "Agregar inversión",
        "invest.add.desc1": "El seguimiento manual de inversiones llega pronto. Esto necesita posiciones reales, lotes de compra/venta, costo promedio y almacenamiento de datos de mercado para que tu cartera se mantenga precisa.",
        "invest.add.desc2": "Por ahora, la inteligencia de inversiones se mantiene visible como hoja de ruta, pero las partes avanzadas están bloqueadas hasta que el backend de inversiones confiable esté listo.",

        // Settings — Danger zone (Delete account)
        "settings.section.danger": "Zona peligrosa",
        "settings.danger.desc": "Acciones permanentes. No hay vuelta atrás.",
        "settings.delete_account": "Eliminar cuenta",
        "settings.delete_account.desc": "Borra tus transacciones, presupuestos, metas y tu cuenta. Esta acción no se puede deshacer.",
        "settings.delete_account.cta": "Eliminar mi cuenta",
        "delete.account.title": "Eliminar tu cuenta de FinTrack",
        "delete.account.desc": "Esto borra de forma permanente tus transacciones, presupuestos, metas, pagos recurrentes y tu cuenta. No podremos recuperar nada después.",
        "delete.account.bullet_data": "Todos tus datos se eliminan de nuestros servidores en un plazo de 30 días.",
        "delete.account.bullet_subscription": "Si tienes una suscripción activa, cancélala primero en Ajustes → Facturación.",
        "delete.account.bullet_email": "Este correo no podrá abrir una nueva prueba de FinTrack — por diseño.",
        "delete.account.label": "Escribe la palabra <code>delete</code> para confirmar:",
        "delete.account.confirm": "Eliminar mi cuenta",
        "delete.account.deleting": "Eliminando…",
        "delete.account.error_generic": "No se pudo eliminar la cuenta. Inténtalo de nuevo."
    }
};

// English baseline cache. Captured from HTML defaults on the first applyLanguage
// call (when the DOM is still in English), and from t() fallback arguments
// whenever JS dynamically sets translatable text. This is what lets us switch
// back to English from French/Spanish without losing the original wording —
// the en: {} dictionary is intentionally empty so we rely on this cache.
const EN_BASELINE = {
    text: Object.create(null),
    placeholder: Object.create(null),
    title: Object.create(null),
    aria: Object.create(null),
};
let _enBaselineCaptured = false;

function t(key, fallback) {
    if (key && fallback !== undefined && fallback !== null && fallback !== "" && !(key in EN_BASELINE.text)) {
        EN_BASELINE.text[key] = fallback;
    }
    const dict = TRANSLATIONS[CURRENT_LANG] || {};
    if (dict[key]) return dict[key];
    if (EN_BASELINE.text[key]) return EN_BASELINE.text[key];
    return fallback !== undefined ? fallback : key;
}

function translateCategory(name) {
    if (!name) return name;
    const key = `category.${String(name).trim().toLowerCase()}`;
    const dict = TRANSLATIONS[CURRENT_LANG] || {};
    return dict[key] || name;
}

function applyLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) lang = "en";
    CURRENT_LANG = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = "ltr";

    const dict = TRANSLATIONS[lang] || {};
    const capture = !_enBaselineCaptured;

    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (!key) return;
        if (capture && !(key in EN_BASELINE.text)) {
            EN_BASELINE.text[key] = el.textContent;
        }
        el.textContent = dict[key] || EN_BASELINE.text[key] || el.textContent;
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (!key) return;
        if (capture && !(key in EN_BASELINE.placeholder)) {
            EN_BASELINE.placeholder[key] = el.placeholder;
        }
        el.placeholder = dict[key] || EN_BASELINE.placeholder[key] || el.placeholder;
    });

    document.querySelectorAll("[data-i18n-title]").forEach(el => {
        const key = el.getAttribute("data-i18n-title");
        if (!key) return;
        if (capture && !(key in EN_BASELINE.title)) {
            EN_BASELINE.title[key] = el.title;
        }
        el.title = dict[key] || EN_BASELINE.title[key] || el.title;
    });

    document.querySelectorAll("[data-i18n-aria]").forEach(el => {
        const key = el.getAttribute("data-i18n-aria");
        if (!key) return;
        const aria = el.getAttribute("aria-label") || "";
        if (capture && !(key in EN_BASELINE.aria)) {
            EN_BASELINE.aria[key] = aria;
        }
        el.setAttribute("aria-label", dict[key] || EN_BASELINE.aria[key] || aria);
    });

    _enBaselineCaptured = true;

    try { localStorage.setItem("fintrack.lang", lang); } catch (e) {}

    if (typeof loadRecurringPayments === "function") {
        try { loadRecurringPayments(); } catch (e) {}
    }
    if (typeof loadDetectedSubscriptions === "function") {
        try { loadDetectedSubscriptions(); } catch (e) {}
    }
    if (typeof loadMoneyCoachHistory === "function") {
        try { loadMoneyCoachHistory(); } catch (e) {}
    }
    if (typeof loadMoneyCoachInsights === "function") {
        try { loadMoneyCoachInsights(); } catch (e) {}
    }
    if (typeof loadCashflowForecast === "function" && cashflowLatest) {
        try { renderCashflowForecast(cashflowLatest); } catch (e) {}
    }
}

(function applyInitialLanguage() {
    let lang = "en";
    try { lang = localStorage.getItem("fintrack.lang") || "en"; } catch (e) {}
    if (!SUPPORTED_LANGS.includes(lang)) lang = "en";
    CURRENT_LANG = lang;
})();

function isFinTrackApiUrl(input) {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    if (!rawUrl) return false;

    try {
        const requestUrl = new URL(rawUrl, window.location.href);
        const apiUrl = new URL(API, window.location.href);
        return requestUrl.origin === apiUrl.origin && requestUrl.pathname.startsWith(apiUrl.pathname.replace(/\/$/, ''));
    } catch (error) {
        return false;
    }
}

window.fetch = function fintrackFetch(input, options = {}) {
    if (!isFinTrackApiUrl(input)) {
        return nativeFetch(input, options);
    }

    return nativeFetch(input, {
        credentials: 'include',
        ...options
    });
};

let allCategories = [];
let transactionsLoadedFromBackend = false;
let allRecurringPayments = [];
let allGoals = [];
let lastDashboardData = null;
let lastDetectedSubscriptionsData = null;
let lastBillingUser = null;
let recentGoalSavingsAnimation = null;
document.body.dataset.activePage = 'dashboard';

function getTransactionSource() {
    return transactionsLoadedFromBackend
        ? allTransactions
        : (SHOW_DEMO_DATA ? DEMO_TRANSACTIONS : []);
}

function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
}

function addProductionEmptyNote(selector, text) {
    const container = document.querySelector(selector);
    if (!container || container.querySelector('.production-empty-note')) return;

    const note = document.createElement('div');
    note.className = 'production-empty-note';
    note.textContent = text;
    container.appendChild(note);
}

function isAuthError(error) {
    return Boolean(error && (error.isAuthError || error.status === 401 || String(error.message || '').includes('Please log in')));
}

function handleUnauthorized() {
    const now = Date.now();
    if (window.fintrackLastAuthToast && now - window.fintrackLastAuthToast < 2500) return;
    window.fintrackLastAuthToast = now;
    showToast('Please log in to continue');
}

async function getResponseError(response, fallbackMessage = 'Request failed') {
    let message = fallbackMessage;

    try {
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            const data = await response.json();
            message = data.error || data.message || message;
        } else {
            const text = await response.text();
            message = text || message;
        }
    } catch (error) {
        message = fallbackMessage;
    }

    const error = new Error(response.status === 401 ? 'Please log in' : message);
    error.status = response.status;
    error.isAuthError = response.status === 401;

    return error;
}

async function throwIfNotOk(response, fallbackMessage = 'Request failed') {
    if (response.ok) return response;

    const error = await getResponseError(response, fallbackMessage);
    if (error.isAuthError) handleUnauthorized();
    throw error;
}

function handleFetchError(error, fallbackMessage = 'Something went wrong') {
    if (isAuthError(error)) {
        handleUnauthorized();
        return;
    }

    const message = error?.message && error.message !== 'Failed to fetch'
        ? error.message
        : fallbackMessage;

    showToast(message);
}

async function logoutUser() {
    const button = document.getElementById("logoutBtn");
    const originalLabel = button?.querySelector(".logout-text")?.textContent || "Log out";

    try {
        if (button) {
            button.disabled = true;
            const label = button.querySelector(".logout-text");
            if (label) label.textContent = "Logging out...";
        }

        const response = await fetch(`${AUTH_API}/logout`, { method: "POST" });
        await throwIfNotOk(response, "Could not log out");

        window.location.href = "landing.html";
    } catch (error) {
        handleFetchError(error, "Could not log out");
        if (button) {
            button.disabled = false;
            const label = button.querySelector(".logout-text");
            if (label) label.textContent = originalLabel;
        }
    }
}

function initializeLogout() {
    document.getElementById("logoutBtn")?.addEventListener("click", logoutUser);
}

function getFinTrackAssetUrl(path) {
    if (!path) return "";

    try {
        return new URL(path, API.replace(/\/api\/?$/, "/")).href;
    } catch (error) {
        return path;
    }
}

function getProfileInitials(name = "", email = "") {
    const cleanName = String(name || "").trim();
    const parts = cleanName.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return String(email || "FT").slice(0, 2).toUpperCase();
}

function formatMemberSince(createdAt, status = "trial") {
    const label = status === "premium" ? "Premium Member" : "Trial Member";
    const date = createdAt ? new Date(createdAt) : null;

    if (!date || Number.isNaN(date.getTime())) {
        return label;
    }

    return `${label} since ${date.toLocaleDateString(undefined, {
        month: "short",
        year: "numeric"
    })}`;
}

function sanitizeCurrencyCode(value) {
    const code = String(value || "").trim().toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : "";
}

function setPreferredCurrency(value, { refresh = true } = {}) {
    const nextCurrency = sanitizeCurrencyCode(value) || "USD";
    if (nextCurrency === CURRENT_CURRENCY) return;

    CURRENT_CURRENCY = nextCurrency;
    localStorage.setItem("fintrack-currency", CURRENT_CURRENCY);

    if (refresh) {
        refreshCurrencySensitiveViews();
    }
}

function formatCurrency(value, { compact = false } = {}) {
    const amount = Math.abs(parseFloat(value) || 0);

    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: CURRENT_CURRENCY,
            notation: compact ? "compact" : "standard",
            minimumFractionDigits: compact ? 0 : 2,
            maximumFractionDigits: compact ? 1 : 2
        }).format(amount);
    } catch (error) {
        return `${CURRENT_CURRENCY} ${amount.toLocaleString("en-US", {
            minimumFractionDigits: compact ? 0 : 2,
            maximumFractionDigits: compact ? 1 : 2
        })}`;
    }
}

function refreshCurrencySensitiveViews() {
    if (lastDashboardData) {
        renderDashboard(lastDashboardData);
    } else if (typeof loadDashboard === "function") {
        loadDashboard();
    }

    if (typeof updateTransactionMonthlySummary === "function") {
        try { updateTransactionMonthlySummary(); } catch (e) {}
    }
    if (typeof renderTable === "function") {
        try { renderTable(); } catch (e) {}
    }
    if (typeof renderBudgets === "function" && typeof allBudgets !== "undefined") {
        try { renderBudgets(allBudgets); } catch (e) {}
    }
    if (typeof updateBudgetStats === "function" && typeof allBudgets !== "undefined") {
        try { updateBudgetStats(allBudgets); } catch (e) {}
    }
    if (typeof renderGoals === "function" && typeof allGoals !== "undefined") {
        try { renderGoals(allGoals); } catch (e) {}
    }
    if (typeof updateGoalStats === "function" && typeof allGoals !== "undefined") {
        try { updateGoalStats(allGoals); } catch (e) {}
    }
    if (typeof renderRecurringPayments === "function" && typeof allRecurringPayments !== "undefined") {
        try { renderRecurringPayments(allRecurringPayments); } catch (e) {}
    }
    if (typeof updateRecurringStats === "function" && typeof allRecurringPayments !== "undefined") {
        try { updateRecurringStats(allRecurringPayments); } catch (e) {}
    }
    if (lastDetectedSubscriptionsData && typeof renderDetectedSubscriptions === "function") {
        try { renderDetectedSubscriptions(lastDetectedSubscriptionsData); } catch (e) {}
    }
    if (typeof buildIncomeChart === "function") {
        try { buildIncomeChart(); } catch (e) {}
    }
    if (typeof buildPortfolioChart === "function") {
        try { buildPortfolioChart(); } catch (e) {}
    }
}

function applyCurrentUserProfile(user = {}) {
    // First-login onboarding gate: open the 4-step modal if the user has
    // never completed it, otherwise force-close it. The close branch defends
    // against any earlier code path that opened the modal with stale data.
    if (user && !user.onboarding_completed_at && typeof openOnboardingModal === "function") {
        openOnboardingModal(user);
    } else if (user && user.onboarding_completed_at && typeof closeOnboardingModal === "function") {
        closeOnboardingModal();
    }

    const name = String(user.name || "John Doe").trim();
    const email = String(user.email || "john.doe@email.com").trim();
    const subscriptionStatus = String(user.subscription_status || "trial").trim().toLowerCase();
    const initials = getProfileInitials(name, email);
    const imageUrl = getFinTrackAssetUrl(user.profile_image_url);

    document.querySelectorAll("[data-profile-avatar]").forEach(avatar => {
        avatar.textContent = initials;

        if (imageUrl) {
            avatar.style.backgroundImage = `url("${imageUrl}")`;
            avatar.classList.add("has-image");
        } else {
            avatar.style.backgroundImage = "";
            avatar.classList.remove("has-image");
        }
    });

    const nameParts = name.split(/\s+/).filter(Boolean);
    const firstName = user.first_name || nameParts[0] || "";
    const lastName  = user.last_name  || nameParts.slice(1).join(" ");
    const phone     = user.phone || "";
    const { dialCode, number: phoneNumber } = splitPhone(phone);

    setText(".user-name", name);
    const isPaid = ["active", "premium", "subscribed"].includes(subscriptionStatus);
    setText(".user-plan", isPaid ? t("plan.premium", "Premium Plan") : t("plan.trial", "Trial Plan"));
    renderTrialBanner(user);
    document.getElementById("sidebarUserProfile")?.classList.add("is-loaded");
    setText("#settingsProfileName", name);
    setText("#settingsProfileEmail", email);
    setText("#settingsProfileSince", formatMemberSince(user.created_at || user.trial_started_at, subscriptionStatus));

    const firstNameInput   = document.getElementById("settingsFirstName");
    const lastNameInput    = document.getElementById("settingsLastName");
    const emailInput       = document.getElementById("settingsEmail");
    const phoneInput       = document.getElementById("settingsPhone");
    const phoneCountrySel  = document.getElementById("settingsPhoneCountry");

    if (firstNameInput)  firstNameInput.value = firstName;
    if (lastNameInput)   lastNameInput.value  = lastName;
    if (emailInput)      emailInput.value     = email;
    if (phoneInput)      phoneInput.value     = phoneNumber;
    if (phoneCountrySel) {
        const match = Array.from(phoneCountrySel.options).find(o => o.value === dialCode);
        phoneCountrySel.value = match ? dialCode : "";
    }

    const currencySelect = document.getElementById("settingsCurrency");
    if (currencySelect) {
        const savedCurrency = user.preferred_currency || "";
        const match = Array.from(currencySelect.options).find(o => o.value === savedCurrency);
        currencySelect.value = match ? savedCurrency : "";
    }
    setPreferredCurrency(user.preferred_currency);

    const languageSelect = document.getElementById("settingsLanguage");
    const savedLang = user.preferred_language || "";
    if (languageSelect && savedLang) languageSelect.value = savedLang;
    if (savedLang && SUPPORTED_LANGS.includes(savedLang) && savedLang !== CURRENT_LANG) {
        applyLanguage(savedLang);
        refreshAddNewButtonLabel();
        refreshActivePageMeta();
        refreshDynamicI18n();
    }

    updateBillingSettings(user);
    updateEmailVerificationSettings(user);
}

function updateEmailVerificationSettings(user = {}) {
    const statusEl = document.getElementById("emailVerificationStatus");
    const resendBtn = document.getElementById("resendVerificationBtn");
    const verified = Boolean(user.email_verified || user.email_verified_at);

    if (statusEl) {
        statusEl.textContent = verified
            ? "Verified. Security and billing emails can reach you."
            : "Not verified yet. Check your inbox for the verification link.";
    }

    if (resendBtn) {
        resendBtn.hidden = verified;
        resendBtn.disabled = false;
    }
}

async function resendVerificationEmail() {
    const button = document.getElementById("resendVerificationBtn");
    const original = button ? button.textContent : "";

    try {
        if (button) {
            button.disabled = true;
            button.textContent = "Sending...";
        }

        const response = await fetch(`${AUTH_API}/resend-verification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        await throwIfNotOk(response, "Could not send verification email");
        const data = await response.json();
        showToast(data.message || "Verification email sent");
        loadCurrentUserProfile();
    } catch (error) {
        handleFetchError(error, "Could not send verification email");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = original || "Resend";
        }
    }
}

function isTruthyFlag(value) {
    return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function getBillingDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatBillingDate(value) {
    const date = value instanceof Date ? value : getBillingDate(value);
    if (!date) return t("settings.billing.period_unknown", "End of current billing period");
    return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function renderTrialBanner(user = {}) {
    const banner = document.getElementById("trialBanner");
    const textEl = document.getElementById("trialBannerText");
    if (!banner || !textEl) return;

    const status = String(user.subscription_status || "trial").trim().toLowerCase();
    const isPaid = ["active", "premium", "subscribed"].includes(status);
    const trialEndsAt = getBillingDate(user.trial_ends_at);

    if (isPaid || !trialEndsAt) {
        banner.hidden = true;
        return;
    }

    // Days remaining, rounded UP so "23h59m left" still reads as "1 day".
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysLeft = Math.ceil((trialEndsAt.getTime() - Date.now()) / msPerDay);

    let message;
    let severity;
    if (daysLeft <= 0) {
        // trial_ends_at is in the past but Stripe hasn't flipped the status yet
        message = t("trial.banner.expired", "Your trial has ended — subscribe to keep your data.");
        severity = "is-critical";
    } else if (daysLeft === 1) {
        message = t("trial.banner.last_day", "Last day of your free trial — subscribe to keep access.");
        severity = "is-critical";
    } else if (daysLeft <= 3) {
        const template = t("trial.banner.urgent", "Only {n} days left in your trial — subscribe to keep your data.");
        message = template.replace("{n}", daysLeft);
        severity = "is-warning";
    } else {
        const template = t("trial.banner.days_left", "{n} days left in your free trial.");
        message = template.replace("{n}", daysLeft);
        severity = "";
    }

    banner.classList.remove("is-warning", "is-critical");
    if (severity) banner.classList.add(severity);
    textEl.textContent = message;
    banner.hidden = false;
}

function updateBillingSettings(user = {}) {
    lastBillingUser = user || {};
    const statusEl = document.getElementById("settingsBillingStatus");
    const subscribeBtn = document.getElementById("settingsSubscribeBtn");
    const cancelBtn = document.getElementById("settingsCancelSubscriptionBtn");
    const manageBtn = document.getElementById("settingsManageBtn");
    const portalHint = document.getElementById("settingsBillingHint");
    if (!statusEl && !subscribeBtn && !cancelBtn && !manageBtn) return;

    const status = String(user.subscription_status || "trial").toLowerCase();
    const trialEndsAt = getBillingDate(user.trial_ends_at);
    const currentPeriodEnd = getBillingDate(user.subscription_current_period_end) || trialEndsAt;
    const trialExpired = status === "trial" && trialEndsAt && Date.now() > trialEndsAt.getTime();
    const isPaid = ["active", "premium", "subscribed"].includes(status);
    const isEnded = ["canceled", "unpaid", "incomplete_expired"].includes(status);
    const hasStripeCustomer = !!user.stripe_customer_id;
    const hasStripeSubscription = !!user.stripe_subscription_id;
    const isStripeManaged = hasStripeSubscription && !isEnded;
    const cancelAtPeriodEnd = isTruthyFlag(user.subscription_cancel_at_period_end);

    if (statusEl) {
        if (cancelAtPeriodEnd && isStripeManaged) {
            statusEl.textContent = t(
                "settings.billing.status_cancel_scheduled",
                "Your subscription is scheduled to cancel on {date}. You can keep using FinTrack Pro until then."
            ).replace("{date}", formatBillingDate(currentPeriodEnd));
        } else if (status === "past_due" || status === "incomplete") {
            statusEl.textContent = t("settings.billing.status_past_due", "Payment needs attention. Manage your subscription to keep access.");
        } else if (status === "trial" && hasStripeSubscription) {
            if (trialEndsAt || currentPeriodEnd) {
                statusEl.textContent = t(
                    "settings.billing.status_trial_stripe",
                    "Your Stripe trial is active. Cancel before {date} to avoid the first charge."
                ).replace("{date}", formatBillingDate(trialEndsAt || currentPeriodEnd));
            } else {
                statusEl.textContent = t("settings.billing.status_trial_stripe_no_date", "Your Stripe trial is active. You can cancel before the trial ends.");
            }
        } else if (isPaid) {
            statusEl.textContent = t("settings.billing.status_active", "Your FinTrack Pro subscription is active.");
        } else if (trialExpired) {
            statusEl.textContent = t("settings.billing.status_expired", "Your trial has ended. Subscribe to continue.");
        } else if (trialEndsAt) {
            statusEl.textContent = `Trial ends ${trialEndsAt.toLocaleDateString()}. Then $4.99/mo USD or $6.99/mo CAD.`;
        } else {
            statusEl.textContent = t("settings.billing.status_trial", "14-day trial, then $4.99/mo USD or $6.99/mo CAD.");
        }
    }

    if (subscribeBtn) {
        subscribeBtn.hidden = isPaid || isStripeManaged;
        subscribeBtn.disabled = false;
        subscribeBtn.textContent = t("settings.billing.subscribe", "Subscribe");
    }

    if (cancelBtn) {
        cancelBtn.hidden = !isStripeManaged || cancelAtPeriodEnd;
        cancelBtn.disabled = false;
        cancelBtn.textContent = t("settings.billing.cancel", "Cancel subscription");
    }

    if (manageBtn) {
        manageBtn.hidden = !hasStripeCustomer;
        manageBtn.disabled = false;
        manageBtn.textContent = t("settings.billing.manage", "Manage subscription");
    }

    if (portalHint) {
        portalHint.hidden = !hasStripeCustomer;
    }
}

const COUNTRY_DIAL_CODES = [
    ["Afghanistan","+93"],["Albania","+355"],["Algeria","+213"],["Andorra","+376"],["Angola","+244"],
    ["Antigua and Barbuda","+1"],["Argentina","+54"],["Armenia","+374"],["Australia","+61"],["Austria","+43"],
    ["Azerbaijan","+994"],["Bahamas","+1"],["Bahrain","+973"],["Bangladesh","+880"],["Barbados","+1"],
    ["Belarus","+375"],["Belgium","+32"],["Belize","+501"],["Benin","+229"],["Bhutan","+975"],
    ["Bolivia","+591"],["Bosnia and Herzegovina","+387"],["Botswana","+267"],["Brazil","+55"],["Brunei","+673"],
    ["Bulgaria","+359"],["Burkina Faso","+226"],["Burundi","+257"],["Cambodia","+855"],["Cameroon","+237"],
    ["Canada","+1"],["Cape Verde","+238"],["Central African Republic","+236"],["Chad","+235"],["Chile","+56"],
    ["China","+86"],["Colombia","+57"],["Comoros","+269"],["Congo (DRC)","+243"],["Congo (Republic)","+242"],
    ["Costa Rica","+506"],["Côte d'Ivoire","+225"],["Croatia","+385"],["Cuba","+53"],["Cyprus","+357"],
    ["Czech Republic","+420"],["Denmark","+45"],["Djibouti","+253"],["Dominica","+1"],["Dominican Republic","+1"],
    ["Ecuador","+593"],["Egypt","+20"],["El Salvador","+503"],["Equatorial Guinea","+240"],["Eritrea","+291"],
    ["Estonia","+372"],["Eswatini","+268"],["Ethiopia","+251"],["Fiji","+679"],["Finland","+358"],
    ["France","+33"],["Gabon","+241"],["Gambia","+220"],["Georgia","+995"],["Germany","+49"],
    ["Ghana","+233"],["Greece","+30"],["Grenada","+1"],["Guatemala","+502"],["Guinea","+224"],
    ["Guinea-Bissau","+245"],["Guyana","+592"],["Haiti","+509"],["Honduras","+504"],["Hong Kong","+852"],
    ["Hungary","+36"],["Iceland","+354"],["India","+91"],["Indonesia","+62"],["Iran","+98"],
    ["Iraq","+964"],["Ireland","+353"],["Israel","+972"],["Italy","+39"],["Jamaica","+1"],
    ["Japan","+81"],["Jordan","+962"],["Kazakhstan","+7"],["Kenya","+254"],["Kiribati","+686"],
    ["Kosovo","+383"],["Kuwait","+965"],["Kyrgyzstan","+996"],["Laos","+856"],["Latvia","+371"],
    ["Lebanon","+961"],["Lesotho","+266"],["Liberia","+231"],["Libya","+218"],["Liechtenstein","+423"],
    ["Lithuania","+370"],["Luxembourg","+352"],["Macau","+853"],["Madagascar","+261"],["Malawi","+265"],
    ["Malaysia","+60"],["Maldives","+960"],["Mali","+223"],["Malta","+356"],["Marshall Islands","+692"],
    ["Mauritania","+222"],["Mauritius","+230"],["Mexico","+52"],["Micronesia","+691"],["Moldova","+373"],
    ["Monaco","+377"],["Mongolia","+976"],["Montenegro","+382"],["Morocco","+212"],["Mozambique","+258"],
    ["Myanmar","+95"],["Namibia","+264"],["Nauru","+674"],["Nepal","+977"],["Netherlands","+31"],
    ["New Zealand","+64"],["Nicaragua","+505"],["Niger","+227"],["Nigeria","+234"],["North Korea","+850"],
    ["North Macedonia","+389"],["Norway","+47"],["Oman","+968"],["Pakistan","+92"],["Palau","+680"],
    ["Palestine","+970"],["Panama","+507"],["Papua New Guinea","+675"],["Paraguay","+595"],["Peru","+51"],
    ["Philippines","+63"],["Poland","+48"],["Portugal","+351"],["Qatar","+974"],["Romania","+40"],
    ["Russia","+7"],["Rwanda","+250"],["Saint Kitts and Nevis","+1"],["Saint Lucia","+1"],["Saint Vincent and the Grenadines","+1"],
    ["Samoa","+685"],["San Marino","+378"],["São Tomé and Príncipe","+239"],["Saudi Arabia","+966"],["Senegal","+221"],
    ["Serbia","+381"],["Seychelles","+248"],["Sierra Leone","+232"],["Singapore","+65"],["Slovakia","+421"],
    ["Slovenia","+386"],["Solomon Islands","+677"],["Somalia","+252"],["South Africa","+27"],["South Korea","+82"],
    ["South Sudan","+211"],["Spain","+34"],["Sri Lanka","+94"],["Sudan","+249"],["Suriname","+597"],
    ["Sweden","+46"],["Switzerland","+41"],["Syria","+963"],["Taiwan","+886"],["Tajikistan","+992"],
    ["Tanzania","+255"],["Thailand","+66"],["Timor-Leste","+670"],["Togo","+228"],["Tonga","+676"],
    ["Trinidad and Tobago","+1"],["Tunisia","+216"],["Turkey","+90"],["Turkmenistan","+993"],["Tuvalu","+688"],
    ["Uganda","+256"],["Ukraine","+380"],["United Arab Emirates","+971"],["United Kingdom","+44"],["United States","+1"],
    ["Uruguay","+598"],["Uzbekistan","+998"],["Vanuatu","+678"],["Vatican City","+39"],["Venezuela","+58"],
    ["Vietnam","+84"],["Yemen","+967"],["Zambia","+260"],["Zimbabwe","+263"]
];

const KNOWN_DIAL_CODES = Array.from(new Set(COUNTRY_DIAL_CODES.map(c => c[1])))
    .sort((a, b) => b.length - a.length);

function splitPhone(phone) {
    if (!phone) return { dialCode: "", number: "" };
    const trimmed = String(phone).trim();
    if (!trimmed.startsWith("+")) return { dialCode: "", number: trimmed };
    for (const code of KNOWN_DIAL_CODES) {
        if (trimmed.startsWith(code)) {
            return { dialCode: code, number: trimmed.slice(code.length).trim() };
        }
    }
    return { dialCode: "", number: trimmed };
}

const CURRENCIES = [
    ["Afghan Afghani","AFN"],["Albanian Lek","ALL"],["Algerian Dinar","DZD"],["Angolan Kwanza","AOA"],
    ["Argentine Peso","ARS"],["Armenian Dram","AMD"],["Aruban Florin","AWG"],["Australian Dollar","AUD"],
    ["Azerbaijani Manat","AZN"],["Bahamian Dollar","BSD"],["Bahraini Dinar","BHD"],["Bangladeshi Taka","BDT"],
    ["Barbadian Dollar","BBD"],["Belarusian Ruble","BYN"],["Belize Dollar","BZD"],["Bermudian Dollar","BMD"],
    ["Bhutanese Ngultrum","BTN"],["Bolivian Boliviano","BOB"],["Bosnia-Herzegovina Convertible Mark","BAM"],
    ["Botswanan Pula","BWP"],["Brazilian Real","BRL"],["British Pound","GBP"],["Brunei Dollar","BND"],
    ["Bulgarian Lev","BGN"],["Burundian Franc","BIF"],["CFA Franc BCEAO","XOF"],["CFA Franc BEAC","XAF"],
    ["CFP Franc","XPF"],["Cambodian Riel","KHR"],["Canadian Dollar","CAD"],["Cape Verdean Escudo","CVE"],
    ["Cayman Islands Dollar","KYD"],["Chilean Peso","CLP"],["Chinese Yuan","CNY"],["Colombian Peso","COP"],
    ["Comorian Franc","KMF"],["Congolese Franc","CDF"],["Costa Rican Colón","CRC"],["Croatian Kuna","HRK"],
    ["Cuban Peso","CUP"],["Czech Koruna","CZK"],["Danish Krone","DKK"],["Djiboutian Franc","DJF"],
    ["Dominican Peso","DOP"],["East Caribbean Dollar","XCD"],["Egyptian Pound","EGP"],["Eritrean Nakfa","ERN"],
    ["Ethiopian Birr","ETB"],["Euro","EUR"],["Falkland Islands Pound","FKP"],["Fijian Dollar","FJD"],
    ["Gambian Dalasi","GMD"],["Georgian Lari","GEL"],["Ghanaian Cedi","GHS"],["Gibraltar Pound","GIP"],
    ["Guatemalan Quetzal","GTQ"],["Guinean Franc","GNF"],["Guyanaese Dollar","GYD"],["Haitian Gourde","HTG"],
    ["Honduran Lempira","HNL"],["Hong Kong Dollar","HKD"],["Hungarian Forint","HUF"],["Icelandic Króna","ISK"],
    ["Indian Rupee","INR"],["Indonesian Rupiah","IDR"],["Iranian Rial","IRR"],["Iraqi Dinar","IQD"],
    ["Israeli New Shekel","ILS"],["Jamaican Dollar","JMD"],["Japanese Yen","JPY"],["Jordanian Dinar","JOD"],
    ["Kazakhstani Tenge","KZT"],["Kenyan Shilling","KES"],["Kuwaiti Dinar","KWD"],["Kyrgystani Som","KGS"],
    ["Laotian Kip","LAK"],["Lebanese Pound","LBP"],["Lesotho Loti","LSL"],["Liberian Dollar","LRD"],
    ["Libyan Dinar","LYD"],["Macanese Pataca","MOP"],["Macedonian Denar","MKD"],["Malagasy Ariary","MGA"],
    ["Malawian Kwacha","MWK"],["Malaysian Ringgit","MYR"],["Maldivian Rufiyaa","MVR"],["Mauritanian Ouguiya","MRU"],
    ["Mauritian Rupee","MUR"],["Mexican Peso","MXN"],["Moldovan Leu","MDL"],["Mongolian Tugrik","MNT"],
    ["Moroccan Dirham","MAD"],["Mozambican Metical","MZN"],["Myanma Kyat","MMK"],["Namibian Dollar","NAD"],
    ["Nepalese Rupee","NPR"],["Netherlands Antillean Guilder","ANG"],["New Taiwan Dollar","TWD"],
    ["New Zealand Dollar","NZD"],["Nicaraguan Córdoba","NIO"],["Nigerian Naira","NGN"],["North Korean Won","KPW"],
    ["Norwegian Krone","NOK"],["Omani Rial","OMR"],["Pakistani Rupee","PKR"],["Panamanian Balboa","PAB"],
    ["Papua New Guinean Kina","PGK"],["Paraguayan Guarani","PYG"],["Peruvian Sol","PEN"],
    ["Philippine Peso","PHP"],["Polish Złoty","PLN"],["Qatari Rial","QAR"],["Romanian Leu","RON"],
    ["Russian Ruble","RUB"],["Rwandan Franc","RWF"],["Saint Helena Pound","SHP"],["Salvadoran Colón","SVC"],
    ["Samoan Tala","WST"],["Saudi Riyal","SAR"],["Serbian Dinar","RSD"],["Seychellois Rupee","SCR"],
    ["Sierra Leonean Leone","SLE"],["Singapore Dollar","SGD"],["Solomon Islands Dollar","SBD"],
    ["Somali Shilling","SOS"],["South African Rand","ZAR"],["South Korean Won","KRW"],["South Sudanese Pound","SSP"],
    ["Sri Lankan Rupee","LKR"],["Sudanese Pound","SDG"],["Surinamese Dollar","SRD"],["Swazi Lilangeni","SZL"],
    ["Swedish Krona","SEK"],["Swiss Franc","CHF"],["Syrian Pound","SYP"],["São Tomé and Príncipe Dobra","STN"],
    ["Tajikistani Somoni","TJS"],["Tanzanian Shilling","TZS"],["Thai Baht","THB"],["Tongan Paʻanga","TOP"],
    ["Trinidad & Tobago Dollar","TTD"],["Tunisian Dinar","TND"],["Turkish Lira","TRY"],
    ["Turkmenistani Manat","TMT"],["UAE Dirham","AED"],["US Dollar","USD"],["Ugandan Shilling","UGX"],
    ["Ukrainian Hryvnia","UAH"],["Uruguayan Peso","UYU"],["Uzbekistan Som","UZS"],["Vanuatu Vatu","VUV"],
    ["Venezuelan Bolívar","VES"],["Vietnamese Đồng","VND"],["Yemeni Rial","YER"],["Zambian Kwacha","ZMW"]
];

function populateCurrencies() {
    const select = document.getElementById("settingsCurrency");
    if (!select || select.options.length > 0) return;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = t("currency.placeholder", "Select currency");
    select.appendChild(placeholder);

    CURRENCIES.forEach(([name, code]) => {
        const opt = document.createElement("option");
        opt.value = code;
        opt.textContent = `${name} (${code})`;
        select.appendChild(opt);
    });
}

async function savePreferences() {
    const currencySelect = document.getElementById("settingsCurrency");
    const languageSelect = document.getElementById("settingsLanguage");
    const saveButton     = document.getElementById("settingsSavePrefsBtn");
    if (!currencySelect && !languageSelect) return;

    const payload = {
        preferred_currency: currencySelect ? currencySelect.value : "",
        preferred_language: languageSelect ? languageSelect.value : ""
    };

    try {
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.dataset.originalText = saveButton.textContent;
            saveButton.textContent = t("toast.saving", "Saving…");
        }

        const response = await fetch(API + "/preferences", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        await throwIfNotOk(response, t("toast.preferences_error", "Could not save preferences"));

        const data = await response.json();
        if (data.user) {
            applyCurrentUserProfile(data.user);
        } else if (payload.preferred_currency) {
            setPreferredCurrency(payload.preferred_currency);
        }

        showToast(t("toast.preferences_saved", "Preferences saved"));
    } catch (error) {
        console.error("Preferences save error:", error);
        handleFetchError(error, t("toast.preferences_error", "Could not save preferences"));
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = saveButton.dataset.originalText || t("settings.save_preferences", "Save Preferences");
        }
    }
}

function initializePreferencesSave() {
    const saveButton = document.getElementById("settingsSavePrefsBtn");
    if (!saveButton) return;
    saveButton.addEventListener("click", savePreferences);

    const languageSelect = document.getElementById("settingsLanguage");
    const currencySelect = document.getElementById("settingsCurrency");
    if (currencySelect) {
        currencySelect.addEventListener("change", () => {
            setPreferredCurrency(currencySelect.value);
        });
    }

    if (languageSelect) {
        languageSelect.addEventListener("change", async () => {
            const newLang = languageSelect.value;
            applyLanguage(newLang);
            refreshAddNewButtonLabel();
            refreshActivePageMeta();
            refreshDynamicI18n();
            try {
                const res = await fetch(API + "/preferences", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ preferred_language: newLang })
                });
                if (res.ok) {
                    showToast(t("toast.preferences_saved", "Preferences saved"));
                }
            } catch (e) {
                console.error("Language save error:", e);
            }
        });
    }
}

function refreshDynamicI18n() {
    if (typeof renderTable === "function") {
        try { renderTable(); } catch (e) {}
    }
    if (typeof refreshTransactionAccountOptions === "function") {
        try { refreshTransactionAccountOptions(); } catch (e) {}
    }
    if (typeof renderCategoryPickerGrid === "function") {
        try { renderCategoryPickerGrid(); } catch (e) {}
    }
    if (typeof renderTxCategoryFilterGrid === "function") {
        try { renderTxCategoryFilterGrid(); } catch (e) {}
    }
    if (typeof renderBudgets === "function" && typeof allBudgets !== "undefined") {
        try { renderBudgets(allBudgets); } catch (e) {}
    }
    if (typeof renderGoals === "function" && typeof allGoals !== "undefined") {
        try { renderGoals(allGoals); } catch (e) {}
    }
    if (typeof updateGoalStats === "function" && typeof allGoals !== "undefined") {
        try { updateGoalStats(allGoals); } catch (e) {}
    }
    if (lastBillingUser) {
        try { updateBillingSettings(lastBillingUser); } catch (e) {}
    }
    const txCatHidden = document.getElementById("txCategoryFilter");
    const txCatIcon   = document.getElementById("txCategoryFilterIcon");
    if (txCatHidden && typeof setTransactionCategoryFilter === "function") {
        try { setTransactionCategoryFilter(txCatHidden.value, txCatIcon ? txCatIcon.textContent : "🏷️"); } catch (e) {}
    }
}

function refreshAddNewButtonLabel() {
    const button = document.getElementById("addNewBtn");
    const label = document.getElementById("addNewBtnLabel");
    const target = document.body.dataset.activePage || "dashboard";
    if (button) {
        button.style.display = (target === "dashboard" || target === "categories" || target === "settings") ? "none" : "";
    }
    if (!label) return;
    label.textContent =
        target === "recurring"   ? t("topnav.add_recurring", "Add Recurring") :
        target === "goals"       ? t("topnav.add_goal", "Add Goal") :
        target === "investments" ? t("topnav.add_investment", "Add Investment") :
        t("topnav.add_new", "Add New");
}

function refreshActivePageMeta() {
    const target = document.body.dataset.activePage || "dashboard";
    const meta = pageMeta[target];
    if (!meta) return;
    const titleEl = document.querySelector(".page-title");
    const subEl   = document.querySelector(".page-subtitle");
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl)   subEl.textContent   = meta.sub;
}

function populateCountryCodes() {
    const select = document.getElementById("settingsPhoneCountry");
    if (!select || select.options.length > 0) return;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = t("phone.country_placeholder", "Country");
    select.appendChild(placeholder);

    COUNTRY_DIAL_CODES.forEach(([name, code]) => {
        const opt = document.createElement("option");
        opt.value = code;
        opt.textContent = `${name} (${code})`;
        select.appendChild(opt);
    });
}

async function saveProfileChanges() {
    const firstNameInput  = document.getElementById("settingsFirstName");
    const lastNameInput   = document.getElementById("settingsLastName");
    const emailInput      = document.getElementById("settingsEmail");
    const phoneInput      = document.getElementById("settingsPhone");
    const phoneCountrySel = document.getElementById("settingsPhoneCountry");
    const saveButton      = document.getElementById("settingsSaveBtn");

    if (!firstNameInput || !lastNameInput || !emailInput) return;

    const phoneNum  = phoneInput ? phoneInput.value.trim() : "";
    const dialCode  = phoneCountrySel ? phoneCountrySel.value : "";
    const phoneFull = phoneNum ? (dialCode ? `${dialCode} ${phoneNum}` : phoneNum) : "";

    const payload = {
        first_name: firstNameInput.value.trim(),
        last_name:  lastNameInput.value.trim(),
        email:      emailInput.value.trim(),
        phone:      phoneFull
    };

    try {
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.dataset.originalText = saveButton.textContent;
            saveButton.textContent = t("toast.saving", "Saving…");
        }

        const response = await fetch(API + "/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        await throwIfNotOk(response, t("toast.profile_error", "Could not save changes"));

        const data = await response.json();
        if (data.user) {
            applyCurrentUserProfile(data.user);
        }

        showToast(t("toast.profile_updated", "Profile updated"));
    } catch (error) {
        console.error("Profile save error:", error);
        handleFetchError(error, t("toast.profile_error", "Could not save changes"));
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = saveButton.dataset.originalText || t("settings.save_changes", "Save Changes");
        }
    }
}

function initializeProfileSave() {
    const saveButton = document.getElementById("settingsSaveBtn");
    if (!saveButton) return;
    saveButton.addEventListener("click", saveProfileChanges);
}

function openChangePasswordModal() {
    const modal = document.getElementById("changePasswordModal");
    const form = document.getElementById("changePasswordForm");
    const message = document.getElementById("changePasswordMessage");
    if (form) form.reset();
    if (message) {
        message.textContent = "";
        message.style.color = "";
    }
    if (modal) modal.style.display = "flex";
}

function closeChangePasswordModal() {
    const modal = document.getElementById("changePasswordModal");
    if (modal) modal.style.display = "none";
}

async function submitChangePassword(event) {
    event.preventDefault();
    const currentPassword = document.getElementById("currentPasswordInput")?.value || "";
    const newPassword = document.getElementById("newPasswordInput")?.value || "";
    const confirmPassword = document.getElementById("confirmNewPasswordInput")?.value || "";
    const message = document.getElementById("changePasswordMessage");
    const submitBtn = document.getElementById("changePasswordSubmit");

    const setMessage = (text, isError = false) => {
        if (!message) return;
        message.textContent = text;
        message.style.color = isError ? "var(--red)" : "var(--green)";
    };

    if (newPassword !== confirmPassword) {
        setMessage("New passwords do not match.", true);
        return;
    }

    if (newPassword.length < 8) {
        setMessage("New password must be at least 8 characters.", true);
        return;
    }

    const original = submitBtn ? submitBtn.textContent : "";
    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Saving...";
        }

        const response = await fetch(`${AUTH_API}/change-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword,
            }),
        });
        await throwIfNotOk(response, "Could not change password");
        setMessage("Password changed successfully.");
        showToast("Password changed successfully");
        setTimeout(closeChangePasswordModal, 800);
    } catch (error) {
        if (isAuthError(error)) {
            handleUnauthorized();
            return;
        }
        setMessage(error.message || "Could not change password", true);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = original || "Save Password";
        }
    }
}

function initializeChangePassword() {
    const openBtn = document.getElementById("changePasswordBtn");
    const closeBtn = document.getElementById("changePasswordModalClose");
    const cancelBtn = document.getElementById("changePasswordCancel");
    const form = document.getElementById("changePasswordForm");
    const modal = document.getElementById("changePasswordModal");

    if (openBtn) openBtn.addEventListener("click", openChangePasswordModal);
    if (closeBtn) closeBtn.addEventListener("click", closeChangePasswordModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeChangePasswordModal);
    if (form) form.addEventListener("submit", submitChangePassword);
    if (modal) {
        modal.addEventListener("click", (event) => {
            if (event.target === modal) closeChangePasswordModal();
        });
    }
}

async function loadCurrentUserProfile() {
    try {
        const response = await fetch(API + "/profile");
        await throwIfNotOk(response, "Could not load profile");
        const data = await response.json();

        if (data.user) {
            applyCurrentUserProfile(data.user);
        }
    } catch (error) {
        console.error("Error loading profile:", error);
        if (isAuthError(error)) handleUnauthorized();
    }
}

async function startStripeCheckout() {
    const button = document.getElementById("settingsSubscribeBtn");
    const originalLabel = button ? button.textContent : "";
    if (button) {
        button.disabled = true;
        button.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>${t("settings.billing.redirecting", "Redirecting…")}`;
    }

    try {
        const response = await fetch(API + "/billing/create-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currency: CURRENT_CURRENCY || "USD" })
        });
        await throwIfNotOk(response, t("settings.billing.error", "Could not start checkout"));
        const data = await response.json();
        if (!data.url) throw new Error(t("settings.billing.error", "Could not start checkout"));
        window.location.href = data.url;
    } catch (error) {
        handleFetchError(error, t("settings.billing.error", "Could not start checkout"));
        if (button) {
            button.disabled = false;
            button.textContent = originalLabel || t("settings.billing.subscribe", "Subscribe");
        }
    }
}

async function openStripeBillingPortal() {
    const button = document.getElementById("settingsManageBtn");
    const originalLabel = button ? button.textContent : "";
    if (button) {
        button.disabled = true;
        button.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>${t("settings.billing.redirecting", "Redirecting…")}`;
    }

    try {
        const response = await fetch(API + "/billing/portal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        if (response.status === 409) {
            // User has no Stripe customer yet — bounce them to checkout instead.
            return startStripeCheckout();
        }
        await throwIfNotOk(response, t("settings.billing.portal_error", "Could not open billing portal"));
        const data = await response.json();
        if (!data.url) throw new Error(t("settings.billing.portal_error", "Could not open billing portal"));
        window.location.href = data.url;
    } catch (error) {
        handleFetchError(error, t("settings.billing.portal_error", "Could not open billing portal"));
        if (button) {
            button.disabled = false;
            button.textContent = originalLabel || t("settings.billing.manage", "Manage subscription");
        }
    }
}

async function downloadAccountExport() {
    const button = document.getElementById("settingsExportBtn");
    const originalLabel = button ? button.textContent : "";
    if (button) {
        button.disabled = true;
        button.textContent = t("settings.data.preparing", "Preparing your data…");
    }

    try {
        const response = await fetch(API + "/account/export", {
            method: "GET",
            credentials: "include",
        });
        if (!response.ok) {
            throw new Error(t("settings.data.error", "Couldn't prepare your export. Please try again."));
        }
        const blob = await response.blob();

        // Pull filename out of Content-Disposition if Flask gave us one
        const cd = response.headers.get("Content-Disposition") || "";
        const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
        const today = new Date().toISOString().slice(0, 10);
        const filename = (match && decodeURIComponent(match[1])) || `fintrack-export-${today}.zip`;

        // Trigger the download via a temporary <a download> link
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(t("settings.data.downloaded", "Your data is downloading."));
    } catch (error) {
        handleFetchError(error, t("settings.data.error", "Couldn't prepare your export. Please try again."));
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalLabel || t("settings.data.download", "Download .zip");
        }
    }
}

function openCancelSubscriptionModal() {
    const modal = document.getElementById("cancelSubscriptionModal");
    const periodEl = document.getElementById("cancelSubscriptionPeriod");
    const confirmBtn = document.getElementById("confirmCancelSubscriptionBtn");
    const cancelBtn = document.getElementById("cancelSubscriptionKeep");
    if (!modal) return;

    const user = lastBillingUser || {};
    const periodEnd = user.subscription_current_period_end || user.trial_ends_at;
    if (periodEl) {
        periodEl.textContent = formatBillingDate(periodEnd);
    }
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = t("settings.billing.cancel_modal.confirm", "Confirm cancellation");
    }
    if (cancelBtn) cancelBtn.disabled = false;

    modal.style.display = "flex";
    document.body.classList.add("modal-open");
}

function closeCancelSubscriptionModal() {
    const modal = document.getElementById("cancelSubscriptionModal");
    if (!modal) return;
    modal.style.display = "none";
    document.body.classList.remove("modal-open");
}

async function confirmCancelSubscription() {
    const confirmBtn = document.getElementById("confirmCancelSubscriptionBtn");
    const keepBtn = document.getElementById("cancelSubscriptionKeep");
    const originalLabel = confirmBtn ? confirmBtn.textContent : "";

    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = t("settings.billing.canceling", "Canceling…");
    }
    if (keepBtn) keepBtn.disabled = true;

    try {
        const response = await fetch(API + "/billing/cancel-subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirm: true }),
        });
        await throwIfNotOk(response, t("settings.billing.cancel_error", "Could not cancel subscription"));
        const data = await response.json();

        closeCancelSubscriptionModal();
        if (data.user) {
            applyCurrentUserProfile(data.user);
        } else {
            loadCurrentUserProfile();
        }
        showToast(data.message || t("settings.billing.cancel_success", "Subscription cancellation scheduled."));
    } catch (error) {
        handleFetchError(error, t("settings.billing.cancel_error", "Could not cancel subscription"));
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalLabel || t("settings.billing.cancel_modal.confirm", "Confirm cancellation");
        }
        if (keepBtn) keepBtn.disabled = false;
    }
}

function initializeBillingActions() {
    document.getElementById("settingsSubscribeBtn")?.addEventListener("click", startStripeCheckout);
    document.getElementById("trialBannerCta")?.addEventListener("click", (event) => {
        const btn = event.currentTarget;
        if (btn) {
            btn.disabled = true;
            btn.textContent = t("settings.billing.redirecting", "Redirecting…");
        }
        startStripeCheckout();
    });
    document.getElementById("settingsManageBtn")?.addEventListener("click", openStripeBillingPortal);
    document.getElementById("settingsExportBtn")?.addEventListener("click", downloadAccountExport);
    document.getElementById("settingsCancelSubscriptionBtn")?.addEventListener("click", openCancelSubscriptionModal);
    document.getElementById("cancelSubscriptionModalClose")?.addEventListener("click", closeCancelSubscriptionModal);
    document.getElementById("cancelSubscriptionKeep")?.addEventListener("click", closeCancelSubscriptionModal);
    document.getElementById("confirmCancelSubscriptionBtn")?.addEventListener("click", confirmCancelSubscription);

    const modal = document.getElementById("cancelSubscriptionModal");
    if (modal) {
        modal.addEventListener("click", (event) => {
            if (event.target === modal) closeCancelSubscriptionModal();
        });
    }
}

function handleBillingReturnState() {
    const params = new URLSearchParams(window.location.search || "");
    const billingState = params.get("billing");
    if (!billingState) return;

    if (billingState === "success") {
        showToast("Subscription updated");
        loadCurrentUserProfile();
    } else if (billingState === "cancelled") {
        showToast("Checkout cancelled");
    } else if (billingState === "returned") {
        // Coming back from the Stripe Customer Portal — refresh profile to
        // pick up any subscription changes the user made there.
        loadCurrentUserProfile();
    }

    params.delete("billing");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
}

async function uploadProfilePicture(file) {
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    const maxBytes = 2 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
        showToast("Please upload a PNG, JPG, WEBP, or GIF image");
        return;
    }

    if (file.size > maxBytes) {
        showToast("Profile picture must be 2MB or smaller");
        return;
    }

    const editButton = document.getElementById("settingsAvatarEdit");
    const formData = new FormData();
    formData.append("avatar", file);

    try {
        if (editButton) {
            editButton.classList.add("uploading");
            editButton.textContent = "…";
        }

        const response = await fetch(API + "/profile/avatar", {
            method: "POST",
            body: formData
        });
        await throwIfNotOk(response, "Could not upload profile picture");

        const data = await response.json();
        if (data.user) {
            applyCurrentUserProfile(data.user);
        }

        showToast("Profile picture updated");
    } catch (error) {
        console.error("Profile picture upload error:", error);
        handleFetchError(error, "Could not upload profile picture");
    } finally {
        if (editButton) {
            editButton.classList.remove("uploading");
            editButton.textContent = "📷";
        }
    }
}

function initializeProfilePictureUpload() {
    const editButton = document.getElementById("settingsAvatarEdit");
    const fileInput = document.getElementById("profileAvatarUpload");

    if (!editButton || !fileInput) return;

    editButton.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        uploadProfilePicture(file);
        fileInput.value = "";
    });
}

function applyDemoDataMode() {
    document.body.classList.toggle('no-demo-data', !SHOW_DEMO_DATA);
    document.body.classList.toggle('demo-data-enabled', SHOW_DEMO_DATA);

    if (SHOW_DEMO_DATA) return;

    document.querySelectorAll([
        '#dashboard-recent-tx > .tx-item',
        '#page-dashboard .accounts-list > .account-item',
        '#page-dashboard .budget-list > .budget-item',
        '#page-dashboard .invest-list > .invest-item',
        '#page-dashboard .goals-grid > .goal-card',
        '#page-budgets .budget-cards-grid > .budget-full-card',
        '#page-goals .goals-page-grid > .goal-page-card',
        '#page-recurring tbody > tr',
        '#allocationList > .alloc-item',
        '#holdingsTableBody > tr'
    ].join(',')).forEach(el => el.classList.add('demo-only'));

    document.querySelectorAll('#page-dashboard .stat-change').forEach(el => el.classList.add('demo-only'));

    setText('#stat-balance', fmt(0));
    setText('#stat-income', fmt(0));
    setText('#stat-expenses', fmt(0));
    setText('.tb-amount', fmt(0));
    setText('#page-dashboard .tb-sub', t('empty.accounts.banner', 'Track per-account balances by adding transactions'));
    setText('#page-dashboard .donut-amount', fmt(0));

    document.querySelectorAll('#page-budgets .stats-row .stat-value, #page-recurring .stats-row .stat-value')
        .forEach(el => {
            el.textContent = fmt(0);
        });
    setText('#recurring-due-week-count', t('empty.recurring.due', '0 payments due'));
    setText('#inv-total-value', fmt(0));
    setText('#inv-today-change', fmt(0));
    setText('#inv-total-return', fmt(0));
    setText('#inv-total-invested', fmt(0));
    setText('#inv-invested-note', t('empty.invest.invested_note', 'Add investments to track cost basis'));
    setText('#portfolioChartSummary', t('empty.invest.portfolio_summary', 'Add investments to compare portfolio performance.'));

    addProductionEmptyNote('#page-dashboard .accounts-list', t('empty.accounts.list', 'Your accounts will appear here as you add transactions.'));
    addProductionEmptyNote('#page-dashboard .budget-list', t('empty.budgets.list', 'Create budgets to see budget progress here.'));
    addProductionEmptyNote('#page-dashboard .invest-list', t('empty.invest.list', 'Add investments to see portfolio holdings here.'));
    addProductionEmptyNote('#page-dashboard .goals-grid', t('empty.goals.list', 'Create goals to track savings progress here.'));
}

const DEFAULT_CATEGORIES = [
    { name: 'Income', icon: '💰' },
    { name: 'Groceries', icon: '🛒' },
    { name: 'Entertainment', icon: '🎬' },
    { name: 'Transport', icon: '🚗' },
    { name: 'Utilities', icon: '⚡' },
    { name: 'Housing', icon: '🏠' },
    { name: 'Dining', icon: '🍽️' },
    { name: 'Health', icon: '💊' },
    { name: 'Shopping', icon: '🛍️' },
    { name: 'Other', icon: '🏷️' }
];

// ── THEME ──
const html = document.documentElement;
const savedTheme = localStorage.getItem('fintrack-theme') || 'light';
html.setAttribute('data-theme', savedTheme);
document.getElementById('moonIcon').style.display = savedTheme === 'dark' ? 'none' : 'block';
document.getElementById('sunIcon').style.display  = savedTheme === 'dark' ? 'block' : 'none';

document.getElementById('themeToggle').addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('fintrack-theme', next);
    document.getElementById('moonIcon').style.display = next === 'dark' ? 'none' : 'block';
    document.getElementById('sunIcon').style.display  = next === 'dark' ? 'block' : 'none';
    if (window.incomeChart) buildIncomeChart();
});

// ── SIDEBAR COLLAPSE ──
document.getElementById('sidebarCollapse').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('main').classList.toggle('collapsed');
});

// ── NAVIGATION ──
const PAGE_META_KEYS = {
    dashboard:    { title: "page.dashboard.title",    sub: "page.dashboard.sub" },
    transactions: { title: "page.transactions.title", sub: "page.transactions.sub" },
    budgets:      { title: "page.budgets.title",      sub: "page.budgets.sub" },
    goals:        { title: "page.goals.title",        sub: "page.goals.sub" },
    investments:  { title: "page.investments.title",  sub: "page.investments.sub" },
    recurring:    { title: "page.recurring.title",    sub: "page.recurring.sub" },
    categories:   { title: "page.categories.title",   sub: "page.categories.sub" },
    settings:     { title: "page.settings.title",     sub: "page.settings.sub" }
};

const PAGE_META_FALLBACK = {
    dashboard:    { title: "Home",               sub: "Your money overview at a glance." },
    transactions: { title: "Transactions",       sub: "See where your money comes from and where it goes." },
    budgets:      { title: "Budgets",            sub: "Track weekly, monthly, and custom budgets." },
    goals:        { title: "Goals",              sub: "Follow your savings progress and future plans." },
    investments:  { title: "Investments",        sub: "Monitor your investment performance." },
    recurring:    { title: "Recurring Payments", sub: "Manage regular bills, subscriptions, and repeated income." },
    categories:   { title: "Money Coach",        sub: "Ask practical questions and get guidance from your real FinTrack data." },
    settings:     { title: "Settings",           sub: "Personalize your FinTrack experience." }
};

const pageMeta = new Proxy({}, {
    get(_target, page) {
        const keys = PAGE_META_KEYS[page];
        const fall = PAGE_META_FALLBACK[page];
        if (!keys || !fall) return undefined;
        return { title: t(keys.title, fall.title), sub: t(keys.sub, fall.sub) };
    }
});

document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = item.dataset.page;

        if (target === 'investments' && !window.fintrackInvestmentPreviewAccepted) {
            openInvestmentPreviewModal();
            return;
        }

        document.body.dataset.activePage = target;
        document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const pg = document.getElementById('page-' + target);
        if (pg) pg.classList.add('active');
        if (pageMeta[target]) {
            document.querySelector('.page-title').textContent    = pageMeta[target].title;
            document.querySelector('.page-subtitle').textContent = pageMeta[target].sub;
        }

        const topSearchInput = document.querySelector('.search-bar input');

        if (topSearchInput) {
            topSearchInput.placeholder =
                target === 'transactions' ? t('topnav.search', 'Search transactions...') :
                target === 'budgets' ? t('topnav.search_budgets', 'Search budgets...') :
                target === 'goals' ? t('topnav.search_goals', 'Search goals...') :
                target === 'investments' ? t('topnav.search_investments', 'Search investments...') :
                t('topnav.search_default', 'Search...');
        }

        /* Hide duplicate top search on Transactions page */
        const topSearchBar =
            document.querySelector('.topbar-search') ||
            document.querySelector('.header-search') ||
            document.querySelector('.navbar-search') ||
            document.querySelector('.search-bar');

        if (topSearchBar) {
            topSearchBar.style.display =
                target === 'transactions' || target === 'categories' ? 'none' : '';
        }

        const addNewBtn = document.getElementById('addNewBtn');
        const addNewBtnLabel = document.getElementById('addNewBtnLabel');
        if (addNewBtn) {
            addNewBtn.style.display = (target === 'dashboard' || target === 'categories' || target === 'settings') ? 'none' : '';
        }

        if (addNewBtnLabel) {
            addNewBtnLabel.textContent =
                target === 'recurring' ? t('topnav.add_recurring', 'Add Recurring') :
                target === 'goals' ? t('topnav.add_goal', 'Add Goal') :
                target === 'investments' ? t('topnav.add_investment', 'Add Investment') :
                t('topnav.add_new', 'Add New');
        }

        // Load data for each page when clicked
        if (target === 'transactions') loadTransactions();
        if (target === 'budgets')      loadBudgets();
        if (target === 'goals')        loadGoals();
        if (target === 'investments')  loadInvestments();
        if (target === 'categories')   refreshMoneyCoachPage();
    });
});

function openSettingsPageFromProfile() {
    document.querySelector('.nav-item[data-page="settings"]')?.click();
}

const sidebarUserProfile = document.getElementById("sidebarUserProfile");
if (sidebarUserProfile) {
    sidebarUserProfile.addEventListener("click", openSettingsPageFromProfile);
    sidebarUserProfile.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openSettingsPageFromProfile();
        }
    });
}

// ══════════════════════════════════════
//  HELPER — format money
// ══════════════════════════════════════
function fmt(n) {
    return formatCurrency(n);
}

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ══════════════════════════════════════
//  CATEGORIES
// ══════════════════════════════════════
async function loadCategories() {
    try {
        const res = await fetch(API + '/categories');
        await throwIfNotOk(res, 'Could not load categories');
        const data = await res.json();

        if (!Array.isArray(data)) {
            throw new Error('Could not load categories');
        }

        allCategories = data.length > 0 ? data : [...DEFAULT_CATEGORIES];
        refreshTransactionCategoryOptions();
        renderCategoryPickerGrid('');
        renderTxCategoryFilterGrid('');
    } catch (err) {
        console.log('Using fallback categories');
        if (isAuthError(err)) handleUnauthorized();
        allCategories = [...DEFAULT_CATEGORIES];
        refreshTransactionCategoryOptions();
        renderCategoryPickerGrid('');
        renderTxCategoryFilterGrid('');
    }
}

function renderTransactionCategoryOptions() {
    // Premium picker no longer uses a native <select>.
    // This function now only keeps category state ready for the picker and filters.
    refreshTransactionCategoryOptions();
}

function getCategoryIcon(categoryName) {
    const match = allCategories.find(cat => (cat.name || '').toLowerCase() === String(categoryName || '').toLowerCase());
    return match?.icon || '🏷️';
}

// ══════════════════════════════════════
//  DASHBOARD — load real data from API
// ══════════════════════════════════════
async function loadDashboard() {
    try {
        // Fetch the explicit accounts list in parallel with dashboard — they
        // both feed the Accounts card and we want them rendered together.
        const [res] = await Promise.all([
            fetch(API + '/dashboard'),
            loadAccounts(),
        ]);
        await throwIfNotOk(res, 'Dashboard request failed');
        const data = await res.json();
        lastDashboardData = data;

        renderDashboard(data);

        if (typeof loadDailyInsights === "function") {
            loadDailyInsights();
        }
        if (typeof loadCashflowForecast === "function") {
            loadCashflowForecast();
        }

    } catch (err) {
        console.log('Dashboard data unavailable');
        if (isAuthError(err)) handleUnauthorized();
        if (!SHOW_DEMO_DATA) {
            lastDashboardData = null;
            setText('#stat-balance', fmt(0));
            setText('#stat-income', fmt(0));
            setText('#stat-expenses', fmt(0));
            setText('.tb-amount', fmt(0));
            renderRecentTransactions([]);
        }
    }
}

function renderDashboard(data = {}) {
    // Total Balance can be negative (you've spent more than your opening
    // balance + income). fmt() strips the sign, so we prepend "-" manually
    // and flip the .is-negative class for red styling.
    const balance = parseFloat(data.total_balance) || 0;
    const balanceEl = document.querySelector('#stat-balance');
    if (balanceEl) {
        balanceEl.textContent = (balance < 0 ? '-' : '') + fmt(balance);
        balanceEl.classList.toggle('is-negative', balance < 0);
    }
    document.querySelector('#stat-income').textContent   = fmt(data.monthly_income);
    document.querySelector('#stat-expenses').textContent = fmt(data.monthly_expenses);
    setText('#page-dashboard .donut-amount', fmt(data.monthly_expenses));

    // Update accounts total balance banner (same negative-aware treatment)
    const bannerEl = document.querySelector('.tb-amount');
    if (bannerEl) {
        bannerEl.textContent = (balance < 0 ? '-' : '') + fmt(balance);
        bannerEl.classList.toggle('is-negative', balance < 0);
    }

    // Recent transactions list on dashboard
    renderRecentTransactions(data.recent_transactions);

    // Per-account balances rolled up from all transactions
    renderDashboardAccountsList();
}

let allAccounts = [];

async function loadAccounts() {
    try {
        const res = await fetch(API + '/accounts', { credentials: 'include' });
        if (!res.ok) {
            allAccounts = [];
            return;
        }
        const data = await res.json();
        allAccounts = Array.isArray(data) ? data : [];
    } catch (err) {
        if (isAuthError(err)) handleUnauthorized();
        allAccounts = [];
    }
}

function renderDashboardAccountsList() {
    const listEl = document.querySelector('#page-dashboard .accounts-list');
    if (!listEl) return;

    const txs = Array.isArray(allTransactions) ? allTransactions : [];
    const explicitAccounts = Array.isArray(allAccounts) ? allAccounts : [];

    if (txs.length === 0 && explicitAccounts.length === 0) {
        // Leave the existing empty-state note in place.
        return;
    }

    // Start with $0 entries for every explicit account so accounts with no
    // transactions still show up.
    const balances = new Map();
    for (const acct of explicitAccounts) {
        balances.set(String(acct.name).trim(), 0);
    }

    // Group transactions by account label, sum amounts. Transactions with no
    // account tagged fall under "Cash" (matches the receipt-scan default).
    for (const tx of txs) {
        const name = String(tx.account || 'Cash').trim() || 'Cash';
        balances.set(name, (balances.get(name) || 0) + (parseFloat(tx.amount) || 0));
    }

    // Sort: largest absolute balance first, so the most-active accounts surface.
    const rows = Array.from(balances.entries())
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    listEl.innerHTML = rows.map(([name, bal]) => {
        const isNeg = bal < 0;
        const displayBal = (isNeg ? '-' : '') + fmt(bal);
        return `
            <div class="account-item">
                <div class="account-icon gray-icon">💳</div>
                <div class="account-info">
                    <p class="account-name">${escapeHTML(name)}</p>
                </div>
                <div class="account-right">
                    <p class="account-balance ${isNeg ? 'negative-bal' : ''}">${escapeHTML(displayBal)}</p>
                </div>
            </div>
        `;
    }).join('');
}

// ── Add Account modal ──
function openAccountModal() {
    const modal = document.getElementById('accountModal');
    if (!modal) return;
    document.getElementById('accountForm')?.reset();
    setMessage('accountFormMessage', '');
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('accountName')?.focus(), 80);
}

function closeAccountModal() {
    const modal = document.getElementById('accountModal');
    if (modal) modal.style.display = 'none';
}

function setMessage(id, text, severity) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('error', severity === 'error');
    el.style.display = text ? '' : 'none';
}

function initializeAccountModal() {
    const form = document.getElementById('accountForm');
    if (!form) return;

    document.getElementById('accountModalClose')?.addEventListener('click', closeAccountModal);
    document.getElementById('accountModalCancel')?.addEventListener('click', closeAccountModal);
    document.getElementById('accountModal')?.addEventListener('click', (event) => {
        if (event.target.id === 'accountModal') closeAccountModal();
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const name = document.getElementById('accountName').value.trim();
        const type = document.getElementById('accountType').value || null;
        const rawBalance = document.getElementById('accountOpeningBalance').value.trim();
        const opening_balance = rawBalance === '' ? null : parseFloat(rawBalance);

        if (!name) {
            setMessage('accountFormMessage', t('account.modal.error.name', 'Account name is required'), 'error');
            return;
        }
        if (opening_balance !== null && !Number.isFinite(opening_balance)) {
            setMessage('accountFormMessage', t('account.modal.error.balance', 'Opening balance must be a number'), 'error');
            return;
        }

        const submitBtn = document.getElementById('accountSubmitBtn');
        const originalLabel = submitBtn?.textContent || '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = t('account.modal.saving', 'Saving…');
        }
        setMessage('accountFormMessage', '');

        try {
            const res = await fetch(API + '/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, type, opening_balance }),
            });
            if (!res.ok) {
                throw await getResponseError(res, t('account.modal.error.save', 'Could not save account'));
            }
            await loadAccounts();
            // Re-pull transactions too if we created a seed transaction, so the
            // balances roll up correctly.
            if (typeof loadTransactions === 'function') await loadTransactions();
            if (typeof loadDashboard === 'function') await loadDashboard();
            closeAccountModal();
            showToast(t('account.toast.saved', 'Account added'));
        } catch (error) {
            handleFetchError(error, t('account.modal.error.save', 'Could not save account'));
            setMessage('accountFormMessage', error.message || t('account.modal.error.save', 'Could not save account'), 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalLabel;
            }
        }
    });
}

function renderRecentTransactions(txList) {
    const container = document.querySelector('#dashboard-recent-tx');
    if (!container) return;

    if (!txList || txList.length === 0) {
        if (SHOW_DEMO_DATA) return;

        const note = document.createElement('div');
        note.className = 'production-empty-note';
        note.textContent = 'Add your first transaction to see recent activity here.';
        container.replaceChildren(note);
        return;
    }

    const icons = { Income:'💰', Groceries:'🛒', Entertainment:'🎬', Transport:'🚗', Utilities:'⚡', Housing:'🏠', Dining:'☕', Health:'💊', Shopping:'📦', Other:'💳' };

    const rows = txList.map(tx => {
        const amount = parseFloat(tx.amount || 0);
        const pos = amount > 0;
        const category = String(tx.category || 'Other');
        const txDate = new Date(tx.date);
        const date = Number.isNaN(txDate.getTime())
            ? ''
            : txDate.toLocaleDateString('en-US', { month:'short', day:'numeric' });
        const icon = Object.prototype.hasOwnProperty.call(icons, category) ? icons[category] : '💳';

        const row = document.createElement('div');
        row.className = 'tx-item';

        const iconEl = document.createElement('div');
        iconEl.className = `tx-icon ${pos ? 'green-icon' : 'gray-icon'}`;
        iconEl.textContent = icon;

        const info = document.createElement('div');
        info.className = 'tx-info';

        const nameEl = document.createElement('p');
        nameEl.className = 'tx-name';
        nameEl.textContent = String(tx.name || 'Untitled transaction');

        const metaEl = document.createElement('p');
        metaEl.className = 'tx-meta';
        metaEl.textContent = date ? `${category} · ${date}` : category;

        info.append(nameEl, metaEl);

        const right = document.createElement('div');
        right.className = 'tx-right';

        const amountEl = document.createElement('p');
        amountEl.className = `tx-amount ${pos ? 'positive' : ''}`;
        amountEl.textContent = `${pos ? '+' : '-'}${fmt(amount)}`;

        right.appendChild(amountEl);
        row.append(iconEl, info, right);

        return row;
    });

    container.replaceChildren(...rows);
}

// ══════════════════════════════════════
//  TRANSACTIONS PAGE
// ══════════════════════════════════════
let allTransactions = [];
let filtered        = [];
let currentPage     = 1;
const ROWS          = 10;
const exportTransactionsBtn = document.getElementById("exportTransactionsBtn");
const deleteAllTransactionsBtn = document.getElementById("deleteAllTransactionsBtn");
const clearAllTransactionFiltersBtn = document.getElementById("clearAllTransactionFiltersBtn");
const openTxCategoryFilterBtn = document.getElementById("openTxCategoryFilterBtn");
const advancedFiltersBtn = document.getElementById("advancedFiltersBtn");

async function loadTransactions() {
    try {
        const res = await fetch(API + '/transactions');
        await throwIfNotOk(res, 'Transactions request failed');
        const data = await res.json();

        transactionsLoadedFromBackend = true;
        allTransactions = Array.isArray(data) ? data : [];
        filtered = [...allTransactions];
        currentPage = 1;
        refreshTransactionCategoryOptions();
        refreshTransactionAccountOptions();
        applyFilters();
        if (typeof buildIncomeChart === "function") buildIncomeChart();
        if (typeof buildSpendingChart === "function") buildSpendingChart();
    } catch (err) {
        console.log(SHOW_DEMO_DATA ? 'Using demo transactions' : 'Transactions data unavailable');
        if (isAuthError(err)) handleUnauthorized();
        transactionsLoadedFromBackend = false;
        allTransactions = [];
        filtered = [...getTransactionSource()];
        currentPage = 1;
        refreshTransactionCategoryOptions();
        refreshTransactionAccountOptions();
        applyFilters();
        if (typeof buildIncomeChart === "function") buildIncomeChart();
        if (typeof buildSpendingChart === "function") buildSpendingChart();
    }
}

function updateTransactionActionStates() {
    const source = getTransactionSource();
    const hasTransactions = Array.isArray(source) && source.length > 0;

    const hasActiveFilters =
        !!document.getElementById('txSearch')?.value.trim() ||
        !!document.getElementById('txTypeFilter')?.value ||
        !!document.getElementById('txCategoryFilter')?.value ||
        !!document.getElementById('txAccountFilter')?.value ||
        !!document.getElementById('txDateFromFilter')?.value ||
        !!document.getElementById('txDateToFilter')?.value ||
        (document.getElementById('txSortFilter')?.value && document.getElementById('txSortFilter').value !== 'date_desc');

    if (exportTransactionsBtn) {
        exportTransactionsBtn.disabled = !hasTransactions;
        exportTransactionsBtn.style.opacity = hasTransactions ? '1' : '0.45';
        exportTransactionsBtn.style.cursor = hasTransactions ? 'pointer' : 'not-allowed';
    }

    if (deleteAllTransactionsBtn) {
        deleteAllTransactionsBtn.disabled = !hasTransactions;
        deleteAllTransactionsBtn.style.opacity = hasTransactions ? '1' : '0.45';
        deleteAllTransactionsBtn.style.cursor = hasTransactions ? 'pointer' : 'not-allowed';
    }

    if (clearAllTransactionFiltersBtn) {
        clearAllTransactionFiltersBtn.disabled = !hasActiveFilters;
        clearAllTransactionFiltersBtn.style.opacity = hasActiveFilters ? '1' : '0.45';
        clearAllTransactionFiltersBtn.style.cursor = hasActiveFilters ? 'pointer' : 'not-allowed';
    }

    if (openTxCategoryFilterBtn) {
        openTxCategoryFilterBtn.disabled = !hasTransactions;
        openTxCategoryFilterBtn.style.opacity = hasTransactions ? '1' : '0.55';
        openTxCategoryFilterBtn.style.cursor = hasTransactions ? 'pointer' : 'not-allowed';
    }

    if (advancedFiltersBtn) {
        advancedFiltersBtn.disabled = !hasTransactions;
        advancedFiltersBtn.style.opacity = hasTransactions ? '1' : '0.45';
        advancedFiltersBtn.style.cursor = hasTransactions ? 'pointer' : 'not-allowed';
    }
}

function updateTransactionMonthlySummary() {
    const incomeEl = document.getElementById('txMonthlyIncome');
    const expenseEl = document.getElementById('txMonthlyExpenses');
    const netEl = document.getElementById('txMonthlyNet');
    const countEl = document.getElementById('txMonthlyCount');

    if (!incomeEl || !expenseEl || !netEl || !countEl) return;

    const summaryTransactions = Array.isArray(filtered) ? filtered : [];

    const income = summaryTransactions.reduce((sum, tx) => {
        const amount = parseFloat(tx.amount) || 0;
        return amount > 0 ? sum + amount : sum;
    }, 0);

    const expenses = summaryTransactions.reduce((sum, tx) => {
        const amount = parseFloat(tx.amount) || 0;
        return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);

    const net = income - expenses;

    incomeEl.textContent = '+' + fmt(income);
    expenseEl.textContent = '-' + fmt(expenses);
    netEl.textContent = (net >= 0 ? '+' : '-') + fmt(net);
    netEl.classList.toggle('negative', net < 0);
    const n = summaryTransactions.length;
    const tpl = n === 1
        ? t('tx.visible_count.one', '{n} visible transaction')
        : t('tx.visible_count.other', '{n} visible transactions');
    countEl.textContent = tpl.replace('{n}', n);
}

function renderTable() {
    const tbody = document.getElementById('txTableBody');
    if (!tbody) return;

    const start = (currentPage - 1) * ROWS;
    const slice = filtered.slice(start, start + ROWS);
    const hasActiveFilters =
        !!document.getElementById('txSearch')?.value.trim() ||
        !!document.getElementById('txTypeFilter')?.value ||
        !!document.getElementById('txCategoryFilter')?.value ||
        !!document.getElementById('txAccountFilter')?.value ||
        (document.getElementById('txSortFilter')?.value && document.getElementById('txSortFilter').value !== 'date_desc');

    const icons = { Income:'💰', Groceries:'🛒', Entertainment:'🎬', Transport:'🚗', Utilities:'⚡', Housing:'🏠', Dining:'☕', Health:'💊', Shopping:'📦', Other:'💳' };

    if (filtered.length === 0) {
        const emptyTitle = hasActiveFilters
            ? t('tx.empty.no_match.title', 'No matching transactions')
            : t('tx.empty.no_tx.title', 'No transactions yet');
        const emptyText = hasActiveFilters
            ? t('tx.empty.no_match.text', 'Try adjusting your filters or clear them to see more results.')
            : t('tx.empty.no_tx.text', 'Start by adding your first transaction or importing a CSV file.');
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="premium-empty-state">
                        <div class="premium-empty-state-icon">
                            ${hasActiveFilters ? '🔎' : '🧾'}
                        </div>
                        <h3 class="premium-empty-state-title">${emptyTitle}</h3>
                        <p class="premium-empty-state-text">${emptyText}</p>
                    </div>
                </td>
            </tr>
        `;
    } else {
        const incomeLabel = t('tx.income', 'Income');
        const expenseLabel = t('tx.expense', 'Expense');
        const editTitle = t('tx.edit_tooltip', 'Edit transaction');
        const deleteTitle = t('tx.delete_tooltip', 'Delete transaction');
        const dateLocale = CURRENT_LANG === 'fr' ? 'fr-FR' : CURRENT_LANG === 'es' ? 'es-ES' : 'en-US';
        tbody.innerHTML = slice.map(tx => {
            const pos  = parseFloat(tx.amount) > 0;
            const amt  = (pos ? '+' : '-') + fmt(tx.amount);
            const categoryText = tx.category || 'Other';
            const accountText = tx.account || '—';
            const cat  = categoryText.toLowerCase().replace(/[^a-z0-9_-]/g, '');
            const icon = icons[categoryText] || '💳';
            const date = tx.date ? new Date(tx.date).toLocaleDateString(dateLocale, { month:'short', day:'numeric', year:'numeric' }) : '';
            return `<tr>
                <td><div class="tx-cell-name">
                    <div class="tx-cell-icon ${pos ? 'green-icon' : 'gray-icon'}">${icon}</div>
                    <p class="tx-cell-title">${escapeHTML(tx.name)}</p>
                </div></td>
                <td>
                    <span class="cat-badge ${pos ? 'income type-income-badge' : 'expense type-expense-badge'}">
                        ${pos ? incomeLabel : expenseLabel}
                    </span>
                </td>
                <td><span class="cat-badge ${cat}">${escapeHTML(translateCategory(categoryText))}</span></td>
                <td class="tx-account-cell">${escapeHTML(accountText)}</td>
                <td class="tx-date-cell">${date}</td>
                <td class="tx-amount-cell ${pos ? 'positive' : 'negative'}">${amt}</td>
                <td style="display:flex; gap:8px; align-items:center; justify-content:flex-end;">
                    <button class="dots-btn edit-transaction-btn" data-id="${tx.id}" title="${editTitle}">✎</button>
                    <button class="dots-btn delete-transaction-btn" data-id="${tx.id}" title="${deleteTitle}">✕</button>
                </td>
            </tr>`;
        }).join('');
    }

    const total = filtered.length;
    const paginationTpl = t('tx.pagination.showing', 'Showing {from}–{to} of {total} transactions');
    document.getElementById('paginationInfo').textContent =
        total === 0
        ? (hasActiveFilters ? t('tx.empty.no_match.title', 'No matching transactions') : t('tx.empty.no_tx.title', 'No transactions yet'))
        : paginationTpl.replace('{from}', start + 1).replace('{to}', Math.min(start + ROWS, total)).replace('{total}', total);

    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage >= Math.ceil(total / ROWS);
    document.querySelectorAll('.page-btn[data-pg]').forEach(b =>
        b.classList.toggle('active', parseInt(b.dataset.pg) === currentPage));
    updateTransactionActionStates();
    updateTransactionMonthlySummary();
}

function applyFilters() {
    const s = document.getElementById('txSearch').value.toLowerCase().trim();
    const t = document.getElementById('txTypeFilter').value;
    const c = (document.getElementById('txCategoryFilter').value || '').toLowerCase().trim();
    const a = document.getElementById('txAccountFilter').value;
    const sort = document.getElementById('txSortFilter').value;
    const fromDate = document.getElementById('txDateFromFilter').value;
    const toDate = document.getElementById('txDateToFilter').value;

    const source = getTransactionSource();

    filtered = source.filter(tx => {
        const name = (tx.name || '').toLowerCase();
        const category = (tx.category || '').toLowerCase();
        const account = (tx.account || '');
        const amount = parseFloat(tx.amount) || 0;
        const txDateObj = tx.date ? new Date(tx.date) : null;

        let txDateOnly = '';
        if (txDateObj && !Number.isNaN(txDateObj.getTime())) {
            const year = txDateObj.getFullYear();
            const month = String(txDateObj.getMonth() + 1).padStart(2, '0');
            const day = String(txDateObj.getDate()).padStart(2, '0');
            txDateOnly = `${year}-${month}-${day}`;
        }

        const searchTerms = s.split('/').map(term => term.trim()).filter(Boolean);
        const matchesSearch =
            !s ||
            (searchTerms.length > 1
                ? searchTerms.some(term => name.includes(term) || category.includes(term) || account.toLowerCase().includes(term))
                : name.includes(s) || category.includes(s) || account.toLowerCase().includes(s));

        const matchesType =
            !t || (t === 'income' ? amount > 0 : amount < 0);

        const matchesCategory =
            !c || category.includes(c);

        const matchesAccount =
            !a || account === a;

        const matchesFromDate =
            !fromDate || (txDateOnly && txDateOnly >= fromDate);

        const matchesToDate =
            !toDate || (txDateOnly && txDateOnly <= toDate);

        return (
            matchesSearch &&
            matchesType &&
            matchesCategory &&
            matchesAccount &&
            matchesFromDate &&
            matchesToDate
        );
    });

    filtered.sort((x, y) => {
        const xAmount = parseFloat(x.amount) || 0;
        const yAmount = parseFloat(y.amount) || 0;
        const xDate = new Date(x.date || 0).getTime();
        const yDate = new Date(y.date || 0).getTime();
        const xName = (x.name || '').toLowerCase();
        const yName = (y.name || '').toLowerCase();

        switch (sort) {
            case 'date_asc':
                return xDate - yDate;
            case 'amount_desc':
                return yAmount - xAmount;
            case 'amount_asc':
                return xAmount - yAmount;
            case 'name_asc':
                return xName.localeCompare(yName);
            case 'name_desc':
                return yName.localeCompare(xName);
            case 'date_desc':
            default:
                return yDate - xDate;
        }
    });

    currentPage = 1;
    renderTable();
    updateTransactionActionStates();
}

function refreshTransactionCategoryOptions() {
    const dataList = document.getElementById('txCategoryOptions');
    if (!dataList) return;

    const backendCategories = allCategories
        .map(cat => String(cat.name || '').trim())
        .filter(Boolean);

    const txCategories = getTransactionSource()
        .map(tx => String(tx.category || '').trim())
        .filter(Boolean);

    const uniqueCategories = [...new Set([...backendCategories, ...txCategories])]
        .sort((a, b) => a.localeCompare(b));

    dataList.innerHTML = uniqueCategories
        .map(cat => `<option value="${cat}"></option>`)
        .join('');
}

function refreshTransactionAccountOptions() {
    const accountSelect = document.getElementById('txAccountFilter');
    if (!accountSelect) return;

    const currentValue = accountSelect.value;
    const source = getTransactionSource();

    const accounts = [...new Set(
        source
            .map(tx => String(tx.account || '').trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    accountSelect.innerHTML = `
        <option value="">${t('tx.all_accounts', 'All Accounts')}</option>
        ${accounts.map(account => `<option value="${escapeHTML(account)}">${escapeHTML(account)}</option>`).join('')}
    `;

    if (accounts.includes(currentValue)) {
        accountSelect.value = currentValue;
    }
}

let txSearchDebounceTimer;

document.getElementById('txSearch').addEventListener('input', () => {
    clearTimeout(txSearchDebounceTimer);
    txSearchDebounceTimer = setTimeout(() => {
        applyFilters();
    }, 180);
});
document.getElementById('txTypeFilter').addEventListener('change', applyFilters);
document.getElementById('txAccountFilter').addEventListener('change', applyFilters);
document.getElementById('txSortFilter').addEventListener('change', applyFilters);
document.getElementById('txDateFromFilter').addEventListener('change', applyFilters);
document.getElementById('txDateToFilter').addEventListener('change', applyFilters);
document.getElementById('prevPage').addEventListener('click', () => { currentPage--; renderTable(); });
document.getElementById('nextPage').addEventListener('click', () => { currentPage++; renderTable(); });
document.querySelectorAll('.page-btn[data-pg]').forEach(b => {
    b.addEventListener('click', () => { currentPage = parseInt(b.dataset.pg); renderTable(); });
});

const txTableBody = document.getElementById('txTableBody');

if (txTableBody) {
    txTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-transaction-btn');
        const deleteBtn = e.target.closest('.delete-transaction-btn');

        if (editBtn) {
            const txId = editBtn.dataset.id;
            if (!txId) return;

            const source = getTransactionSource();
            const tx = source.find(item => String(item.id) === String(txId));
            if (!tx) return;

            openTransactionModal(tx);
            return;
        }

        if (deleteBtn) {
            const txId = deleteBtn.dataset.id;
            if (!txId) return;

            openDeleteTransactionModal(txId);
        }
    });
}

const advancedFiltersPanel = document.getElementById('advancedFiltersPanel');
const clearAdvancedFiltersBtn = document.getElementById('clearAdvancedFiltersBtn');

if (advancedFiltersBtn && advancedFiltersPanel) {
    advancedFiltersBtn.addEventListener('click', () => {
        advancedFiltersPanel.style.display =
            advancedFiltersPanel.style.display === 'none' || !advancedFiltersPanel.style.display
                ? 'block'
                : 'none';
    });
}

function clearAllTransactionFilters() {
    const txSearch = document.getElementById('txSearch');
    const txTypeFilter = document.getElementById('txTypeFilter');
    const txAccountFilter = document.getElementById('txAccountFilter');
    const txSortFilter = document.getElementById('txSortFilter');
    const txCategoryFilterSearch = document.getElementById('txCategoryFilterSearch');
    const txDateFromFilter = document.getElementById('txDateFromFilter');
    const txDateToFilter = document.getElementById('txDateToFilter');

    if (txSearch) txSearch.value = '';
    if (txTypeFilter) txTypeFilter.value = '';
    if (txAccountFilter) txAccountFilter.value = '';
    if (txSortFilter) txSortFilter.value = 'date_desc';
    if (txCategoryFilterSearch) txCategoryFilterSearch.value = '';
    if (txDateFromFilter) txDateFromFilter.value = '';
    if (txDateToFilter) txDateToFilter.value = '';

    setTransactionCategoryFilter('', '🏷️');

    filtered = [...getTransactionSource()];
    currentPage = 1;
    applyFilters();

    if (advancedFiltersPanel) {
        advancedFiltersPanel.style.display = 'none';
    }

    if (txCategoryFilterModal) {
        closeTxCategoryFilterModal();
    }

    showToast('Filters cleared');
    updateTransactionActionStates();
}

if (clearAdvancedFiltersBtn) {
    clearAdvancedFiltersBtn.addEventListener('click', clearAllTransactionFilters);
}

if (clearAllTransactionFiltersBtn) {
    clearAllTransactionFiltersBtn.addEventListener('click', clearAllTransactionFilters);
}

// ══════════════════════════════════════
//  BUDGETS PAGE
// ══════════════════════════════════════
let allBudgets = [];

async function loadBudgets() {
    try {
        const res = await fetch(API + '/budgets');
        await throwIfNotOk(res, 'Budgets request failed');
        const data = await res.json();
        allBudgets = Array.isArray(data) ? data : [];

        renderBudgets(allBudgets);
        updateBudgetStats(allBudgets);
    } catch (err) {
        console.log(SHOW_DEMO_DATA ? 'Using demo budgets' : 'Budgets data unavailable');
        if (isAuthError(err)) handleUnauthorized();
        if (!SHOW_DEMO_DATA) {
            allBudgets = [];
            renderBudgets([]);
            updateBudgetStats([]);
        }
    }
    if (typeof loadBudgetSuggestions === 'function') {
        loadBudgetSuggestions();
    }
}

function formatBudgetPaceDate(dateValue) {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return String(dateValue);
    const locale = CURRENT_LANG === 'fr' ? 'fr-FR'
        : CURRENT_LANG === 'es' ? 'es-ES'
        : 'en-US';
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function renderBudgetPace(b, amount) {
    const proj = b && b.projection;
    if (!proj || !amount || amount <= 0) return '';

    const projectedTotal = Number(proj.projected_total || 0);
    const overrunDate = proj.projected_overrun_date;
    const overrunAmount = Number(proj.projected_overrun_amount || 0);

    let tone = 'ok';
    let msg;
    if (overrunDate && overrunAmount > 0) {
        const ratio = projectedTotal / amount;
        tone = ratio >= 1.25 ? 'danger' : 'warn';
        msg = t('budgets.pace.overrun', 'On current pace: {projected} by month end · over budget on {date}')
            .replace('{projected}', fmt(projectedTotal))
            .replace('{date}', formatBudgetPaceDate(overrunDate));
    } else {
        msg = t('budgets.pace.on_track', 'On current pace: {projected} by month end · within budget')
            .replace('{projected}', fmt(projectedTotal));
    }

    return `
        <div class="bfc-pace bfc-pace-${tone}">
            <span class="bfc-pace-dot"></span>
            <span>${escapeHTML(msg)}</span>
        </div>
    `;
}

function renderBudgetSuggestions(data) {
    const card = document.getElementById('budgetSuggestionsCard');
    const chips = document.getElementById('budgetSuggestionChips');
    const meta = document.getElementById('budgetSuggestionsMeta');
    if (!card || !chips) return;

    const suggestions = Array.isArray(data && data.suggestions) ? data.suggestions : [];
    if (!suggestions.length) {
        card.hidden = true;
        return;
    }

    const currency = (data && data.currency) || 'USD';
    if (meta) {
        const days = Number(data.days_of_data || 0);
        if (days >= 60) {
            meta.textContent = t('budgets.suggestions.window_90', 'Based on your last 90 days');
        } else {
            meta.textContent = t('budgets.suggestions.window_partial', 'Based on your last {n} days')
                .replace('{n}', days);
        }
    }

    chips.innerHTML = suggestions.map(s => {
        const cat = String(s.category || 'Other');
        const label = typeof translateCategory === 'function' ? translateCategory(cat) : cat;
        const suggested = Number(s.suggested_amount || 0);
        const avg = Number(s.monthly_average || 0);
        const icon = typeof getCategoryIcon === 'function' ? (getCategoryIcon(cat) || '🏷️') : '🏷️';
        const perMonth = t('budgets.per_month_suffix', '/mo');
        const amountText = `${formatCurrency(suggested, { compact: false })}${perMonth}`;
        const tooltip = t('budgets.suggestions.tooltip', '90-day average: {avg}')
            .replace('{avg}', formatCurrency(avg, { compact: false }));
        return `
            <button type="button" class="budget-suggestion-chip"
                    data-category="${escapeHTML(cat)}"
                    data-amount="${suggested}"
                    title="${escapeHTML(tooltip)}">
                <span class="budget-suggestion-chip-icon" aria-hidden="true">${escapeHTML(icon)}</span>
                <span class="budget-suggestion-chip-text">
                    <strong>${escapeHTML(label)}</strong>
                    <span class="budget-suggestion-chip-amount">${escapeHTML(amountText)}</span>
                </span>
            </button>
        `;
    }).join('');

    chips.querySelectorAll('.budget-suggestion-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category;
            const amount = parseFloat(btn.dataset.amount || '0');
            if (typeof openBudgetModal !== 'function') return;
            openBudgetModal();
            // Pre-fill the form after the modal opens.
            setTimeout(() => {
                if (typeof setSelectedBudgetCategory === 'function') {
                    const icon = typeof getCategoryIcon === 'function' ? (getCategoryIcon(category) || '🏷️') : '🏷️';
                    setSelectedBudgetCategory(category, icon);
                }
                const amtInput = document.getElementById('budgetAmount');
                if (amtInput && amount > 0) amtInput.value = String(amount);
            }, 30);
        });
    });

    card.hidden = false;
}

async function loadBudgetSuggestions() {
    const card = document.getElementById('budgetSuggestionsCard');
    if (!card) return;
    try {
        const res = await fetch(API + '/budgets/suggestions');
        if (res.status === 402) { card.hidden = true; return; }
        await throwIfNotOk(res, 'Suggestions request failed');
        const data = await res.json();
        renderBudgetSuggestions(data);
    } catch (error) {
        if (isAuthError(error)) { handleUnauthorized(); return; }
        card.hidden = true;
    }
}

function renderBudgets(budgets) {
    const budgetsPage = document.getElementById('page-budgets');
    if (!budgetsPage) return;

    const grid = budgetsPage.querySelector('.budget-cards-grid');
    if (!grid) return;

    const colors = ['#10b981', '#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

    const allRows = Array.isArray(budgets) ? budgets : [];
    const expenseBudgets = allRows.filter(isExpenseBudget);
    const incomeBudgetCount = allRows.length - expenseBudgets.length;
    const incomeNoteEl = document.getElementById('budgetIncomeNote');
    if (incomeNoteEl) {
        if (incomeBudgetCount > 0) {
            incomeNoteEl.hidden = false;
            const tpl = incomeBudgetCount === 1
                ? t('budgets.income_hidden.one', 'You have 1 income target hidden from this list — track income in Recurring Payments instead.')
                : t('budgets.income_hidden.many', 'You have {n} income targets hidden from this list — track income in Recurring Payments instead.').replace('{n}', incomeBudgetCount);
            incomeNoteEl.textContent = tpl;
        } else {
            incomeNoteEl.hidden = true;
        }
    }

    budgets = expenseBudgets;

    if (budgets.length === 0) {
        if (SHOW_DEMO_DATA) return;

        grid.innerHTML = `
            <div class="premium-empty-state budgets-empty-state">
                <div class="premium-empty-state-icon">💸</div>
                <h3 class="premium-empty-state-title">${t('budgets.empty.title', 'No budgets yet')}</h3>
                <p class="premium-empty-state-text">${t('budgets.empty.text', 'Create a budget to start tracking spending by category.')}</p>
            </div>
        `;
        return;
    }

    const dateLocale = CURRENT_LANG === 'fr' ? 'fr-FR' : CURRENT_LANG === 'es' ? 'es-ES' : 'en-US';

    const formatShortDate = (dateValue) => {
        if (!dateValue) return '';
        const d = new Date(dateValue);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' });
    };

    const getDaysLeft = (endDateValue) => {
        if (!endDateValue) return '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const end = new Date(endDateValue);
        end.setHours(0, 0, 0, 0);

        const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

        if (diff < 0) return t('budgets.days.ended', 'Ended');
        if (diff === 0) return t('budgets.days.ends_today', 'Ends today');
        if (diff === 1) return t('budgets.days.one_left', '1 day left');
        return t('budgets.days.n_left', '{n} days left').replace('{n}', diff);
    };

    grid.innerHTML = budgets.map((b, i) => {
        const spent = parseFloat(b.spent || 0);
        const amount = parseFloat(b.amount || 0);
        const rawPct = amount > 0 ? Math.round((spent / amount) * 100) : 0;
        const pct = Math.min(rawPct, 100);
        const left = Math.max(amount - spent, 0);
        const cls =
            rawPct > 100 ? 'danger' :
            rawPct >= 75 ? 'warning' :
            'ok';
        const color = colors[i % colors.length];

        const startDate = b.period_start || b.start_date;
        const endDate = b.end_date;
        const rawDays = Number.parseInt(b.period_days || b.days || 30, 10);
        const days = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 30;

        const daysWord = t('budgets.days.suffix', 'days');
        const periodText =
            startDate && endDate
                ? `${formatShortDate(startDate)} → ${formatShortDate(endDate)} · ${days} ${daysWord}`
                : `${days} ${daysWord}`;

        const daysLeft = getDaysLeft(endDate);

        const statusText =
            rawPct > 100 ? t('budgets.status.over', 'Over Budget') :
            rawPct === 100 ? t('budgets.status.at_limit', 'At Limit') :
            rawPct >= 75 ? t('budgets.status.near', 'Near Limit') :
            t('budgets.status.on_track', 'On Track');

        const txCount = Number.parseInt(b.transaction_count || b.tx_count || 0, 10) || 0;
        const safeCategory = escapeHTML(translateCategory(b.category || t('budgets.uncategorized', 'Uncategorized')));
        const safeBudgetId = escapeHTML(b.id ?? '');
        const safePeriodText = escapeHTML(periodText);
        const safeDaysLeft = escapeHTML(daysLeft);

        const budgetSuffix = t('budgets.budget_suffix', 'budget');
        const sourceText = txCount === 1
            ? t('budgets.source.one', 'Spent from {n} transaction').replace('{n}', txCount)
            : t('budgets.source.other', 'Spent from {n} transactions').replace('{n}', txCount);

        return `
        <div class="budget-full-card premium-budget-card" style="--accent:${color}">
            <div class="bfc-top">
                <div style="display:flex;align-items:center;gap:10px;min-width:0">
                    <div class="bfc-icon" style="background:${color}22">💰</div>
                    <div style="min-width:0">
                        <p class="bfc-name">${safeCategory} <span class="budget-mini-tag">• ${days} ${daysWord}</span></p>
                        <p class="bfc-sub">${fmt(amount)} ${budgetSuffix}</p>
                    </div>
                </div>

                <button class="dots-btn edit-budget-btn" data-id="${safeBudgetId}">···</button>
            </div>

            <div class="budget-period-row">
                <span>${safePeriodText}</span>
                <span>${safeDaysLeft}</span>
            </div>

            <div class="budget-status-row">
                <span class="budget-status-badge ${cls}">${statusText}</span>
                <span class="budget-source-text">${sourceText}</span>
            </div>

            <div class="bfc-amounts">
                <span class="bfc-spent">${fmt(spent)}</span>
                <span class="bfc-total"> ${t('budgets.of', 'of')} ${fmt(amount)}</span>
            </div>

            <div class="progress-bar" style="margin:10px 0">
                <div class="progress-fill ${cls}" style="width:${pct}%"></div>
            </div>

            <div class="bfc-footer">
                <span class="bfc-left ${cls}">${fmt(left)} ${t('budgets.left', 'left')}</span>
                <span class="bfc-change">${pct}% ${t('budgets.used', 'used')}</span>
            </div>
            ${renderBudgetPace(b, amount)}
        </div>`;
    }).join('');

    grid.querySelectorAll(".edit-budget-btn").forEach(button => {
        button.addEventListener("click", () => {
            const budgetId = button.dataset.id;
            const budget = allBudgets.find(item => String(item.id) === String(budgetId));
            if (!budget) return;

            openBudgetModal(budget);
        });
    });
}

function isExpenseBudget(b) {
    if (!b) return false;
    const t = String(b.type || '').toLowerCase();
    if (t === 'income') return false;
    if (t === 'expense') return true;
    // Fall back to amount sign + category heuristics when type is missing.
    const amt = parseFloat(b.amount || 0);
    if (amt < 0) return true;
    const cat = String(b.category || '').toLowerCase();
    if (cat === 'income' || cat === 'salary' || cat === 'revenu') return false;
    return true;
}

function getExpenseBudgets(budgets) {
    return (Array.isArray(budgets) ? budgets : []).filter(isExpenseBudget);
}

function updateBudgetStats(budgets) {
    const budgetsPage = document.getElementById('page-budgets');
    if (!budgetsPage) return;

    const statValues = budgetsPage.querySelectorAll('.stats-row .stat-value');
    if (statValues.length < 3) return;

    const expenseBudgets = getExpenseBudgets(budgets);
    const totalBudget = expenseBudgets.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
    const totalSpent = expenseBudgets.reduce((sum, b) => sum + parseFloat(b.spent || 0), 0);

    const positiveRemaining = expenseBudgets.reduce((sum, b) => {
        const amount = parseFloat(b.amount || 0);
        const spent = parseFloat(b.spent || 0);
        return sum + Math.max(amount - spent, 0);
    }, 0);

    const overBudget = expenseBudgets.reduce((sum, b) => {
        const amount = parseFloat(b.amount || 0);
        const spent = parseFloat(b.spent || 0);
        return sum + Math.max(spent - amount, 0);
    }, 0);

    const remaining = Math.max(positiveRemaining - overBudget, 0);

    statValues[0].textContent = fmt(totalBudget);
    statValues[1].textContent = fmt(totalSpent);
    statValues[2].textContent = fmt(remaining);

    const overBudgetEl = document.getElementById("budget-over-total");
    if (overBudgetEl) {
        overBudgetEl.textContent = fmt(overBudget);
    }
}

// ══════════════════════════════════════
//  GOALS PAGE
// ══════════════════════════════════════
async function loadGoals() {
    try {
        const res  = await fetch(API + '/goals');
        await throwIfNotOk(res, 'Goals request failed');
        const data = await res.json();
        allGoals = Array.isArray(data) ? data : [];
        renderGoals(allGoals);
        updateGoalStats(allGoals);
    } catch (err) {
        console.log(SHOW_DEMO_DATA ? 'Using demo goals' : 'Goals data unavailable');
        if (isAuthError(err)) handleUnauthorized();
        if (!SHOW_DEMO_DATA) {
            allGoals = [];
            renderGoals([]);
            updateGoalStats([]);
        }
    }
}

function getGoalStatus(goal, pct) {
    const target = parseFloat(goal.target_amount || 0);
    const savedRaw = goal.effective_saved_amount !== undefined ? goal.effective_saved_amount : goal.saved_amount;
    const saved = parseFloat(savedRaw || 0);
    const remaining = Math.max(target - saved, 0);
    const deadline = goal.deadline ? new Date(goal.deadline) : null;

    const goalDateLocale = CURRENT_LANG === 'fr' ? 'fr-FR' : CURRENT_LANG === 'es' ? 'es-ES' : 'en-US';

    if (pct >= 100) {
        return { label: t('goals.status.completed', 'Completed'), detail: t('goals.detail.target_reached', 'Target reached'), className: 'completed' };
    }

    if (!deadline || Number.isNaN(deadline.getTime())) {
        return { label: t('goals.status.no_timeline', 'No timeline'), detail: t('goals.detail.add_date', 'Add a target date'), className: 'neutral' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
    const deadlineLabel = deadline.toLocaleDateString(goalDateLocale, { month: 'short', day: 'numeric' });
    const remainingRatio = target > 0 ? remaining / target : 0;

    if (daysLeft < 0 && remaining > 0) {
        return {
            label: t('goals.status.missed', 'Missed target'),
            detail: t('goals.detail.left_after', '{amount} left after {date}').replace('{amount}', fmt(remaining)).replace('{date}', deadlineLabel),
            className: 'behind'
        };
    }

    if (
        remaining > 0 &&
        (
            daysLeft <= 7 ||
            (daysLeft <= 14 && remainingRatio >= 0.25) ||
            (daysLeft <= 30 && remainingRatio >= 0.5)
        )
    ) {
        return {
            label: t('goals.status.needs_attention', 'Needs attention'),
            detail: t('goals.detail.left_by', '{amount} left by {date}').replace('{amount}', fmt(remaining)).replace('{date}', deadlineLabel),
            className: 'attention'
        };
    }

    const created = goal.created_at ? new Date(goal.created_at) : null;
    if (!created || Number.isNaN(created.getTime())) {
        return pct >= 50
            ? { label: t('goals.status.on_track', 'On track'), detail: t('goals.detail.left', '{amount} left').replace('{amount}', fmt(remaining)), className: 'on-track' }
            : { label: t('goals.status.behind', 'Behind'), detail: t('goals.detail.left', '{amount} left').replace('{amount}', fmt(remaining)), className: 'behind' };
    }

    created.setHours(0, 0, 0, 0);

    const totalDays = Math.max(1, Math.ceil((deadline - created) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, Math.ceil((today - created) / (1000 * 60 * 60 * 24)));
    const expectedPct = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

    if (pct >= expectedPct * 1.1) {
        return { label: t('goals.status.ahead', 'Ahead'), detail: t('goals.detail.left', '{amount} left').replace('{amount}', fmt(remaining)), className: 'ahead' };
    }

    if (pct >= expectedPct * 0.9) {
        return { label: t('goals.status.on_track', 'On track'), detail: t('goals.detail.left', '{amount} left').replace('{amount}', fmt(remaining)), className: 'on-track' };
    }

    return { label: t('goals.status.behind', 'Behind'), detail: t('goals.detail.left_by', '{amount} left by {date}').replace('{amount}', fmt(remaining)).replace('{date}', deadlineLabel), className: 'behind' };
}

function getGoalMonthlyNeed(goal) {
    const target = parseFloat(goal.target_amount || 0);
    const savedRaw = goal.effective_saved_amount !== undefined ? goal.effective_saved_amount : goal.saved_amount;
    const saved = parseFloat(savedRaw || 0);
    const left = Math.max(target - saved, 0);
    const deadline = goal.deadline ? new Date(goal.deadline) : null;

    if (!deadline || Number.isNaN(deadline.getTime()) || left <= 0) {
        return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthsLeft = Math.max(
        1,
        Math.ceil((deadline - today) / (1000 * 60 * 60 * 24 * 30))
    );

    return left / monthsLeft;
}

function getGoalReminder(goal) {
    const activityDate = goal.last_goal_activity_date || goal.created_at;
    if (!activityDate) return '';

    const activity = new Date(activityDate);
    if (Number.isNaN(activity.getTime())) return '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    activity.setHours(0, 0, 0, 0);

    const daysSince = Math.floor((today - activity) / (1000 * 60 * 60 * 24));

    if (daysSince < 7) return '';

    if (!goal.last_goal_activity_date) {
        return t('goals.reminder.no_savings', 'You have not added savings to this goal in {n} days').replace('{n}', daysSince);
    }

    return t('goals.reminder.no_recent', 'You have not added to this goal in {n} days').replace('{n}', daysSince);
}

function getGoalTargetLabel(deadlineValue) {
    if (!deadlineValue) return t('goals.no_target_date', 'No target date');

    const deadline = new Date(deadlineValue);
    if (Number.isNaN(deadline.getTime())) return t('goals.no_target_date', 'No target date');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);

    const goalDateLocale = CURRENT_LANG === 'fr' ? 'fr-FR' : CURRENT_LANG === 'es' ? 'es-ES' : 'en-US';
    const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
    const dateLabel = deadline.toLocaleDateString(goalDateLocale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    let relativeLabel = '';

    if (daysLeft < 0) {
        const daysAgo = Math.abs(daysLeft);
        relativeLabel = daysAgo === 1
            ? t('goals.days.one_overdue', '1 day overdue')
            : t('goals.days.n_overdue', '{n} days overdue').replace('{n}', daysAgo);
    } else if (daysLeft === 0) {
        relativeLabel = t('goals.days.due_today', 'due today');
    } else if (daysLeft === 1) {
        relativeLabel = t('goals.days.one_left', '1 day left');
    } else {
        relativeLabel = t('goals.days.n_left', '{n} days left').replace('{n}', daysLeft);
    }

    return `${t('goals.target', 'Target')} ${dateLabel} • ${relativeLabel}`;
}

function updateGoalStats(goals) {
    const goalRows = Array.isArray(goals) ? goals : [];
    const totalSaved = goalRows.reduce((sum, goal) => {
        const saved = goal.effective_saved_amount !== undefined ? goal.effective_saved_amount : goal.saved_amount;
        return sum + parseFloat(saved || 0);
    }, 0);
    const targetTotal = goalRows.reduce((sum, goal) => sum + parseFloat(goal.target_amount || 0), 0);
    const remaining = Math.max(targetTotal - totalSaved, 0);
    const completed = goalRows.filter(goal => {
        const saved = goal.effective_saved_amount !== undefined ? goal.effective_saved_amount : goal.saved_amount;
        return parseFloat(saved || 0) >= parseFloat(goal.target_amount || 0);
    }).length;
    const pct = targetTotal > 0 ? Math.min(Math.round((totalSaved / targetTotal) * 100), 100) : 0;

    const totalSavedEl = document.getElementById('goals-total-saved');
    const targetTotalEl = document.getElementById('goals-target-total');
    const remainingEl = document.getElementById('goals-remaining-total');
    const completedEl = document.getElementById('goals-completed-count');
    const progressNoteEl = document.getElementById('goals-progress-note');
    const countNoteEl = document.getElementById('goals-count-note');
    const completeNoteEl = document.getElementById('goals-complete-note');
    const completedNoteEl = document.getElementById('goals-completed-note');

    if (totalSavedEl) totalSavedEl.textContent = fmt(totalSaved);
    if (targetTotalEl) targetTotalEl.textContent = fmt(targetTotal);
    if (remainingEl) remainingEl.textContent = fmt(remaining);
    if (completedEl) completedEl.textContent = `${completed}/${goalRows.length}`;
    if (progressNoteEl) progressNoteEl.textContent = goalRows.length ? t('goals.note.across_active', 'Across active goals') : t('goals.note.build_plan', 'Build your plan');
    if (countNoteEl) countNoteEl.textContent = goalRows.length === 1
        ? t('goals.note.across_one', 'Across {n} goal').replace('{n}', goalRows.length)
        : t('goals.note.across_other', 'Across {n} goals').replace('{n}', goalRows.length);
    if (completeNoteEl) completeNoteEl.textContent = t('goals.note.pct_complete', '{pct}% complete').replace('{pct}', pct);
    if (completedNoteEl) completedNoteEl.textContent = completed ? t('goals.note.nice_progress', 'Nice progress') : t('goals.note.keep_going', 'Keep going');
}

function escapeGoalText(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function loadGoalContributionHistory(goalId) {
    const historyEl = document.querySelector(`[data-goal-history-id="${goalId}"]`);
    if (!historyEl || historyEl.dataset.loaded === "true") return;

    historyEl.innerHTML = `<p class="goal-muted-text">${t('goals.history.loading', 'Loading history...')}</p>`;

    try {
        const response = await fetch(API + `/goals/${goalId}/contributions`);

        await throwIfNotOk(response, t('goals.history.error', 'Failed to load goal history'));

        const rows = await response.json();
        historyEl.dataset.loaded = "true";

        if (!Array.isArray(rows) || rows.length === 0) {
            historyEl.innerHTML = `<p class="goal-muted-text">${t('goals.history.empty', 'No savings history yet. Manual additions and matched savings transactions will appear here.')}</p>`;
            return;
        }

        historyEl.innerHTML = rows.map(item => {
            const isTransaction = item.history_type === 'transaction';
            const sourceLabel = isTransaction
                ? t('goals.history.source.auto', 'Automatically added from transaction')
                : t('goals.history.source.manual', 'You added manually');
            const note = item.note
                ? escapeGoalText(item.note)
                : (isTransaction
                    ? t('goals.history.note.matched', 'Matched savings transaction')
                    : t('goals.history.note.manual', 'Manual savings'));
            const sourceDetail = isTransaction
                ? [item.transaction_category, item.transaction_account].filter(Boolean).join(' • ')
                : '';

            return `
                <div class="goal-history-item">
                    <div>
                        <strong>${fmt(parseFloat(item.amount || 0))}</strong>
                        <span>${note}</span>
                        <em class="goal-history-source ${isTransaction ? 'transaction' : 'manual'}">
                            ${sourceLabel}
                        </em>
                        ${sourceDetail ? `<small>${escapeGoalText(sourceDetail)}</small>` : ''}
                    </div>
                    <time>${formatDate(item.date)}</time>
                </div>
            `;
        }).join("");
    } catch (error) {
        console.error("Error loading goal history:", error);
        historyEl.innerHTML = `<p class="goal-muted-text">${t('goals.history.could_not_load', 'Could not load history.')}</p>`;
    }
}

function fallbackGoalSuggestions(goal) {
    if (!goal) {
        return [{
            title: t('goals.sugg.add_context.title', 'Add context'),
            action: t('goals.sugg.add_context.action', 'Add a few recent transactions so Money Coach can spot real savings opportunities.'),
            why: t('goals.sugg.add_context.why', 'Better data turns this from generic advice into a personal plan.')
        }];
    }

    const target = parseFloat(goal.target_amount || 0);
    const savedRaw = goal.effective_saved_amount !== undefined ? goal.effective_saved_amount : goal.saved_amount;
    const saved = parseFloat(savedRaw || 0);
    const left = Math.max(target - saved, 0);
    const monthlyNeed = getGoalMonthlyNeed(goal);
    const weeklyNeed = monthlyNeed / 4.35;

    if (left <= 0) {
        return [{
            title: t('goals.sugg.complete.title', 'Goal complete'),
            action: t('goals.sugg.complete.action', 'Move new savings toward your next priority instead of letting extra money sit unassigned.'),
            why: t('goals.sugg.complete.why', 'Finished goals should automatically turn into momentum for the next one.')
        }];
    }

    const catLabel = translateCategory(goal.category || t('goals.sugg.this_category', 'this category'));
    const goalLabel = goal.name || t('goals.this_goal', 'this goal');

    return [
        {
            title: t('goals.sugg.week.title', 'This week'),
            action: t('goals.sugg.week.action', 'Move {amount} into this goal this week instead of waiting until month-end.').replace('{amount}', fmt(weeklyNeed)),
            why: t('goals.sugg.week.why', 'Smaller weekly moves make the target feel easier and reduce last-minute pressure.')
        },
        {
            title: t('goals.sugg.tradeoff.title', 'Tradeoff to try'),
            action: t('goals.sugg.tradeoff.action', 'Choose one flexible purchase in {cat} and redirect it into the goal.').replace('{cat}', catLabel),
            why: t('goals.sugg.tradeoff.why', 'Even one skipped expense can make {goal} feel active instead of distant.').replace('{goal}', goalLabel)
        },
        {
            title: t('goals.sugg.auto.title', 'Make it automatic'),
            action: goal.auto_link_savings
                ? t('goals.sugg.auto.action_on', 'Check the automatically added amount after your next savings transaction and remove it if it matched the wrong category.')
                : t('goals.sugg.auto.action_off', 'Turn on Auto savings for this goal so matching savings are added without extra work.'),
            why: t('goals.sugg.auto.why', 'Automation helps the goal keep moving even when you forget to update it manually.')
        }
    ];
}

function renderGoalSuggestions(targetEl, suggestions) {
    const cleanSuggestions = Array.isArray(suggestions) ? suggestions.filter(Boolean).slice(0, 3) : [];

    if (!targetEl) return;

    if (cleanSuggestions.length === 0) {
        targetEl.innerHTML = `<p class="goal-muted-text">${t('goals.sugg.empty', 'No suggestions available yet.')}</p>`;
        return;
    }

    const smartMoveLabel = t('goals.sugg.smart_move', 'Smart move');

    targetEl.innerHTML = cleanSuggestions.map(item => {
        if (typeof item === "string") {
            return `<div class="goal-suggestion-card"><p>${escapeGoalText(item)}</p></div>`;
        }

        return `
            <div class="goal-suggestion-card">
                <h5>${escapeGoalText(item.title || smartMoveLabel)}</h5>
                <p>${escapeGoalText(item.action || '')}</p>
                ${item.why ? `<small>${escapeGoalText(item.why)}</small>` : ''}
            </div>
        `;
    }).join("");
}

async function loadGoalCoachSuggestions(goalId, goal) {
    const suggestionsEl = document.querySelector(`[data-goal-suggestions-id="${goalId}"]`);
    if (!suggestionsEl || suggestionsEl.dataset.loaded === "true") return;

    suggestionsEl.innerHTML = `<p class="goal-muted-text">${t('goals.sugg.loading', 'Money Coach is reviewing this goal...')}</p>`;

    try {
        const response = await fetch(API + `/goals/${goalId}/suggestions`);

        await throwIfNotOk(response, t('goals.sugg.error', 'Failed to load Money Coach suggestions'));

        const data = await response.json();
        suggestionsEl.dataset.loaded = "true";
        renderGoalSuggestions(suggestionsEl, data.suggestions);
    } catch (error) {
        console.error("Error loading goal suggestions:", error);
        suggestionsEl.dataset.loaded = "true";
        renderGoalSuggestions(suggestionsEl, fallbackGoalSuggestions(goal));
    }
}

function animateGoalProgressBars(scope = document) {
    const fills = scope.querySelectorAll('.goal-progress-bar .progress-fill[data-progress]');

    fills.forEach(fill => {
        const progress = fill.dataset.progress || '0';
        fill.style.width = '0%';

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                fill.style.width = `${progress}%`;
            });
        });
    });
}

function clearGoalSavingsAnimation(scope = document) {
    setTimeout(() => {
        scope.querySelectorAll('.goal-added-pop').forEach(item => item.remove());
        recentGoalSavingsAnimation = null;
    }, 1800);
}

function renderGoals(goals) {
    const grid = document.querySelector('.goals-page-grid');
    if (!grid) return;

    if (!goals || goals.length === 0) {
        grid.innerHTML = `
            <div class="premium-empty-state goals-empty-state">
                <div class="premium-empty-state-icon">🎯</div>
                <h3 class="premium-empty-state-title">${t('goals.empty.title', 'No goals yet')}</h3>
                <p class="premium-empty-state-text">${t('goals.empty.text', 'Create your first goal and FinTrack will track your progress here.')}</p>
                <button type="button" class="btn-primary goals-empty-add-btn" id="goalsEmptyAddGoalBtn">${t('topnav.add_goal', 'Add Goal')}</button>
            </div>
        `;
        document.getElementById("goalsEmptyAddGoalBtn")?.addEventListener("click", () => openGoalModal());
        return;
    }

    const colors = ['#10b981','#3b82f6','#f97316','#8b5cf6', '#ec4899', '#14b8a6'];
    grid.innerHTML = goals.map((g, i) => {
        const target = parseFloat(g.target_amount || 0);
        const manualSavedRaw = g.manual_saved_amount !== undefined ? g.manual_saved_amount : g.saved_amount;
        const effectiveSavedRaw = g.effective_saved_amount !== undefined ? g.effective_saved_amount : g.saved_amount;
        const manualSaved = parseFloat(manualSavedRaw || 0);
        const linkedSavings = parseFloat(g.linked_savings_amount || 0);
        const saved = parseFloat(effectiveSavedRaw || 0);
        const pct    = target > 0 ? Math.min(Math.round((saved / target) * 100), 100) : 0;
        const left   = Math.max(target - saved, 0);
        const color  = colors[i % colors.length];
        const targetLabel = getGoalTargetLabel(g.deadline);
        const status = getGoalStatus(g, pct);
        const monthlyNeed = getGoalMonthlyNeed(g);
        const reminderText = getGoalReminder(g);
        const categoryName = g.category || t('goals.default_category', 'Savings');
        const categoryIcon = getCategoryIcon(categoryName);
        const displayIcon = g.icon || categoryIcon || '🎯';
        const safeGoalId = escapeHTML(g.id ?? '');
        const safeGoalName = escapeHTML(g.name || t('goals.untitled', 'Untitled goal'));
        const safeDisplayIcon = escapeHTML(displayIcon);
        const safeCategoryName = escapeGoalText(translateCategory(categoryName));
        const safeCategoryIcon = escapeGoalText(categoryIcon || '🏷️');
        const safeTargetLabel = escapeGoalText(targetLabel);
        const safeStatusLabel = escapeGoalText(status.label);
        const safeReminderText = escapeGoalText(reminderText);
        const autoSavingsHint = g.auto_link_savings
            ? (linkedSavings > 0
                ? `<p class="goal-auto-hint on">${t('goals.auto.includes', 'Includes automatic savings')}</p>`
                : `<p class="goal-auto-hint on">${t('goals.auto.watching', 'Auto savings is watching {cat}').replace('{cat}', safeCategoryName)}</p>`)
            : `<p class="goal-auto-hint off">${t('goals.auto.off', 'Auto savings is off')}</p>`;
        const autoDetailNote = g.auto_link_savings
            ? t('goals.auto.detail_on', 'FinTrack automatically adds matching {cat} savings transactions to this goal.').replace('{cat}', safeCategoryName)
            : t('goals.auto.detail_off', 'Auto savings is off for {cat}. Turn it on to include matching savings transactions.').replace('{cat}', safeCategoryName);
        const showAddedPop = recentGoalSavingsAnimation && String(recentGoalSavingsAnimation.goalId) === String(g.id);
        return `
        <div class="goal-page-card premium-goal-card">
            <div class="gpc-color-bar" style="background:${color}"></div>
            <div class="gpc-body">
                <div class="gpc-top">
                    <div class="goal-title-group">
                        <div class="goal-icon-wrap premium-goal-icon" style="background:${color}22;color:${color};">${safeDisplayIcon}</div>
                        <div>
                            <p class="gpc-name">${safeGoalName}</p>
                            <p class="gpc-date">${safeTargetLabel}</p>
                            <span class="goal-category-chip">${safeCategoryIcon} ${safeCategoryName}</span>
                        </div>
                    </div>
                    <div class="goal-card-actions">
                        <div class="goal-status-stack">
                            <span class="status-badge ${status.className}">${safeStatusLabel}</span>
                        </div>
                        <button class="dots-btn edit-goal-btn" data-id="${safeGoalId}" title="${t('goals.edit_tooltip', 'Edit goal')}">✎</button>
                        <button class="dots-btn delete-goal-btn" data-id="${safeGoalId}" title="${t('goals.delete_tooltip', 'Delete goal')}">✕</button>
                    </div>
                </div>
                <div class="gpc-amounts">
                    <span class="gpc-saved">${t('goals.saved', 'Saved')}: ${fmt(saved)}</span><span class="gpc-target"> / ${fmt(target)}</span>
                    ${showAddedPop ? `<span class="goal-added-pop">+${fmt(recentGoalSavingsAnimation.amount)} ${t('goals.added', 'added')}</span>` : ''}
                </div>
                <div class="progress-bar goal-progress-bar"><div class="progress-fill ok" data-progress="${pct}" style="width:0%;background:${color}"></div></div>
                <div class="gpc-footer"><span>${pct}% ${t('goals.complete', 'complete')}</span><span>${fmt(left)} ${t('goals.to_go', 'to go')}</span></div>
                ${autoSavingsHint}
                <div class="gpc-contrib"><span>${t('goals.save_monthly', 'Save {amount}/month to reach goal').replace('{amount}', fmt(monthlyNeed))}</span></div>
                ${reminderText ? `<p class="goal-reminder">${safeReminderText}</p>` : ''}
                <button type="button" class="goal-breakdown-toggle" data-id="${safeGoalId}">${t('goals.view_details', 'View details')}</button>
                <div class="goal-savings-breakdown" data-breakdown-id="${safeGoalId}" hidden>
                    <section class="goal-detail-section">
                        <h4>${t('goals.savings_details', 'Savings details')}</h4>
                        <div class="goal-detail-row"><span>${t('goals.you_added', 'You added')}</span><strong>${fmt(manualSaved)}</strong></div>
                        <div class="goal-detail-row"><span>${t('goals.auto_added', 'Automatically added')}</span><strong>${fmt(linkedSavings)}</strong></div>
                        <div class="goal-detail-row goal-auto-control-row">
                            <span>${t('goals.auto_for', 'Auto savings for {cat}').replace('{cat}', safeCategoryName)}</span>
                            <strong>${g.auto_link_savings ? t('common.on', 'ON') : t('common.off', 'OFF')}</strong>
                        </div>
                        <p class="goal-detail-note ${g.auto_link_savings ? 'on' : 'off'}">${autoDetailNote}</p>
                    </section>
                    <section class="goal-detail-section">
                        <h4>${t('goals.history', 'History')}</h4>
                        <div class="goal-history-list" data-goal-history-id="${safeGoalId}">
                            <p class="goal-muted-text">${t('goals.history_hint', 'Open details to load history.')}</p>
                        </div>
                    </section>
                    <section class="goal-detail-section">
                        <h4>${t('goals.coach_suggestions', 'Money Coach Suggestions')}</h4>
                        <div class="goal-suggestion-list" data-goal-suggestions-id="${safeGoalId}">
                            <p class="goal-muted-text">${t('goals.coach_hint', 'Open details to load Money Coach suggestions.')}</p>
                        </div>
                    </section>
                </div>
                <div class="goal-card-cta-row">
                    <button type="button" class="goal-contribute-btn" data-id="${safeGoalId}">${t('goals.add_savings', '+ Add Savings')}</button>
                    <div class="goal-link-actions">
                        <span class="goal-link-badge ${g.auto_link_savings ? 'on' : 'off'}">
                            ${t('goals.auto_savings', 'Auto savings')}: ${g.auto_link_savings ? t('common.on', 'ON') : t('common.off', 'OFF')}
                        </span>
                        <button
                            type="button"
                            class="goal-auto-toggle-btn ${g.auto_link_savings ? 'on' : ''}"
                            data-id="${safeGoalId}"
                        >
                            ${g.auto_link_savings ? t('goals.turn_off', 'Turn off') : t('goals.turn_on', 'Turn on')}
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    animateGoalProgressBars(grid);
    if (recentGoalSavingsAnimation) {
        clearGoalSavingsAnimation(grid);
    }

    grid.querySelectorAll('.edit-goal-btn').forEach(button => {
        button.addEventListener('click', () => {
            const goal = allGoals.find(item => String(item.id) === String(button.dataset.id));
            if (goal) openGoalModal(goal);
        });
    });

    grid.querySelectorAll('.delete-goal-btn').forEach(button => {
        button.addEventListener('click', () => {
            openDeleteGoalModal(button.dataset.id);
        });
    });

    grid.querySelectorAll('.goal-contribute-btn').forEach(button => {
        button.addEventListener('click', () => {
            const goal = allGoals.find(item => String(item.id) === String(button.dataset.id));
            if (goal) openGoalContributionModal(goal);
        });
    });

    grid.querySelectorAll('.goal-breakdown-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const breakdown = grid.querySelector(`[data-breakdown-id="${button.dataset.id}"]`);
            if (!breakdown) return;

            const isHidden = breakdown.hasAttribute('hidden');
            if (isHidden) {
                breakdown.removeAttribute('hidden');
                button.textContent = t('goals.hide_details', 'Hide details');
                const goal = allGoals.find(item => String(item.id) === String(button.dataset.id));
                loadGoalContributionHistory(button.dataset.id);
                loadGoalCoachSuggestions(button.dataset.id, goal);
            } else {
                breakdown.setAttribute('hidden', '');
                button.textContent = t('goals.view_details', 'View details');
            }
        });
    });

    grid.querySelectorAll('.goal-auto-toggle-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const goal = allGoals.find(item => String(item.id) === String(button.dataset.id));
            if (!goal) return;

            const enabled = !goal.auto_link_savings;
            button.disabled = true;
            button.textContent = enabled ? t('goals.turning_on', 'Turning on...') : t('goals.turning_off', 'Turning off...');

            const catLabel = goal.category ? translateCategory(goal.category) : t('goals.this_goal', 'this goal');
            try {
                await updateGoalAutoLink(goal, enabled);
                showToast(enabled
                    ? t('goals.toast.auto_on', 'Auto savings turned on for {cat}').replace('{cat}', catLabel)
                    : t('goals.toast.auto_off', 'Auto savings turned off for {cat}').replace('{cat}', catLabel)
                );
            } catch (error) {
                console.error("Error updating auto savings:", error);
                handleFetchError(error, t('goals.toast.auto_error', 'Could not update auto savings'));
                button.disabled = false;
                button.textContent = enabled ? t('goals.turn_on', 'Turn on') : t('goals.turn_off', 'Turn off');
            }
        });
    });
}

// ══════════════════════════════════════
//  CSV UPLOAD — now sends to Flask
// ══════════════════════════════════════
function openCsvModal() {
    selectedCsvFile = null;
    if (csvFileInput) csvFileInput.value = '';
    setCsvUploadStatus('Choose a CSV file, then click Upload & Import.');
    document.getElementById('csvModal').style.display = 'flex';
}

document.querySelectorAll('#importCsvBtn, #importCsvTransactionsBtn').forEach(button => {
    button.addEventListener('click', openCsvModal);
});
document.getElementById('csvModalClose').addEventListener('click', () => {
    selectedCsvFile = null;
    document.getElementById('csvModal').style.display = 'none';
});
document.getElementById('csvModalCancel').addEventListener('click', () => {
    selectedCsvFile = null;
    document.getElementById('csvModal').style.display = 'none';
});
document.getElementById('csvModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('csvModal')) {
        selectedCsvFile = null;
        document.getElementById('csvModal').style.display = 'none';
    }
});

const uploadZone   = document.getElementById('uploadZone');
const csvFileInput = document.getElementById('csvFileInput');
const csvUploadBtn = document.getElementById('csvUploadBtn');
const csvUploadStatus = document.getElementById('csvUploadStatus');
let selectedCsvFile = null;

function setCsvUploadStatus(message, isError = false) {
    if (!csvUploadStatus) return;

    csvUploadStatus.textContent = message;
    csvUploadStatus.classList.toggle('error', isError);
}

function isCsvFile(file) {
    if (!file) return false;

    const fileName = String(file.name || '').toLowerCase();
    const fileType = String(file.type || '').toLowerCase();
    const allowedTypes = ['', 'text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'];

    return fileName.endsWith('.csv') && allowedTypes.includes(fileType);
}

function rejectCsvFile() {
    selectedCsvFile = null;
    if (csvFileInput) csvFileInput.value = '';
    setCsvUploadStatus('CSV files only', true);
}

function selectCsvFile(file) {
    selectedCsvFile = null;

    if (!file) {
        setCsvUploadStatus('Choose a CSV file, then click Upload & Import.');
        return;
    }

    if (!isCsvFile(file)) {
        rejectCsvFile();
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        setCsvUploadStatus('CSV file must be 5MB or smaller.', true);
        if (csvFileInput) csvFileInput.value = '';
        return;
    }

    selectedCsvFile = file;
    setCsvUploadStatus(`Ready to import: ${file.name}`);
}

uploadZone.addEventListener('click', () => csvFileInput.click());
uploadZone.addEventListener('dragover',  (e) => { e.preventDefault(); uploadZone.style.borderColor = 'var(--green)'; });
uploadZone.addEventListener('dragleave', ()  => { uploadZone.style.borderColor = ''; });
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = '';
    selectCsvFile(e.dataTransfer.files[0]);
});
csvFileInput.addEventListener('change', (e) => {
    selectCsvFile(e.target.files[0]);
});

if (csvUploadBtn) {
    csvUploadBtn.addEventListener('click', () => {
        if (!selectedCsvFile) {
            setCsvUploadStatus('Choose a CSV file before importing.');
            return;
        }

        uploadCSV(selectedCsvFile);
    });
}

async function uploadCSV(file) {
    if (!isCsvFile(file)) {
        rejectCsvFile();
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        setCsvUploadStatus('CSV file must be 5MB or smaller.', true);
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    const originalBtnLabel = csvUploadBtn ? csvUploadBtn.textContent : '';
    try {
        setCsvUploadStatus('Uploading...');
        if (csvUploadBtn) {
            csvUploadBtn.disabled = true;
            csvUploadBtn.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>${t('csv.uploading', 'Uploading…')}`;
        }
        const res  = await fetch(API + '/upload-csv', { method:'POST', body: formData, credentials: 'include' });
        await throwIfNotOk(res, 'Upload failed');
        const data = await res.json();

        showToast(`${data.message || 'CSV imported'}${data.source ? ` (${data.source})` : ''}`);
        document.getElementById('csvModal').style.display = 'none';
        selectedCsvFile = null;
        csvFileInput.value = '';
        setCsvUploadStatus('Choose a CSV file, then click Upload & Import.');
        loadDashboard();
        loadTransactions();
    } catch (err) {
        handleFetchError(err, 'Upload failed. Make sure Flask is running.');
        setCsvUploadStatus(isAuthError(err) ? 'Please log in before importing.' : (err.message || 'Upload failed.'), true);
    } finally {
        if (csvUploadBtn) {
            csvUploadBtn.disabled = false;
            csvUploadBtn.textContent = originalBtnLabel || t('csv.upload_btn', 'Upload & Import');
        }
    }
}

// ── CHART TABS ──
document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const card = tab.closest('.chart-card') || tab.closest('.card');
        if (card) card.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        if (card && card.classList.contains('investment-chart-card')) {
            buildPortfolioChart();
        }

        if (card && card.querySelector('#holdingsTableBody')) {
            currentInvestmentHoldingFilter = tab.textContent.trim();
            renderHoldingsTable(allInvestmentHoldings, investmentCurrentTotalValue);
        }

        if (card && card.querySelector('#incomeExpenseChart')) {
            const range = tab.textContent.trim().toLowerCase();
            incomeChartMonths = range.startsWith('6') ? 6
                : range.startsWith('all') || range.startsWith('tout') ? 36
                : 12;
            buildIncomeChart();
        }
    });
});

// ══════════════════════════════════════
//  INVESTMENTS — Real stock prices
// ══════════════════════════════════════
function signedMoney(value) {
    const amount = parseFloat(value || 0);
    const sign = amount >= 0 ? '+' : '-';
    return `${sign}${fmt(amount)}`;
}

function pctText(value) {
    const pct = parseFloat(value);
    if (!Number.isFinite(pct)) return '';

    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
}

let investmentSimulatorPortfolioValue = 0;
let investmentSimulatorReady = false;
let allInvestmentHoldings = [];
let investmentCurrentTotalValue = 0;
let currentInvestmentHoldingFilter = 'All';
let dividendTrackerReady = false;
let dividendTrackerState = { annualTotal: 0, portfolioValue: 0, portfolioYield: 0 };
let investmentAlertsState = [];
let investmentAlertsExpanded = false;
const investmentTargetAllocations = {
    AAPL: 35,
    MSFT: 25,
    VOO: 40
};

async function loadInvestments() {
    try {
        const res  = await fetch(API + '/investments');
        await throwIfNotOk(res, 'Investments request failed');
        const data = await res.json();
        const holdings = Array.isArray(data.holdings) ? data.holdings : [];
        const totalValue = parseFloat(data.total_value || 0);
        const todayChange = parseFloat(data.today_change || 0);
        const totalReturn = parseFloat(data.total_return || 0);
        const totalInvested = parseFloat(data.total_invested || 0);
        const returnPct = Number.isFinite(parseFloat(data.total_return_pct))
            ? parseFloat(data.total_return_pct)
            : totalInvested > 0 ? (totalReturn / totalInvested) * 100 : null;
        allInvestmentHoldings = holdings;
        investmentCurrentTotalValue = totalValue;

        // Update stat cards
        document.querySelector('#inv-total-value').textContent   = fmt(totalValue);

        const todayChangeEl = document.querySelector('#inv-today-change');
        const todayPct = Number.isFinite(parseFloat(data.today_change_pct)) ? parseFloat(data.today_change_pct) : null;
        if (todayChangeEl) {
            todayChangeEl.textContent = `${signedMoney(todayChange)}${todayPct === null ? '' : ` (${pctText(todayPct)})`}`;
            todayChangeEl.style.color = todayChange >= 0 ? 'var(--green)' : 'var(--red)';
        }

        const totalReturnEl = document.querySelector('#inv-total-return');
        if (totalReturnEl) {
            totalReturnEl.textContent = `${signedMoney(totalReturn)}${returnPct === null ? '' : ` (${pctText(returnPct)})`}`;
            totalReturnEl.style.color = totalReturn >= 0 ? 'var(--green)' : 'var(--red)';
        }

        document.querySelector('#inv-total-invested').textContent = fmt(totalInvested);
        const investedNote = document.querySelector('#inv-invested-note');
        if (investedNote) investedNote.textContent = `You invested ${fmt(totalInvested)}`;

        updateAllocationCard(holdings);
        updateHoldingsInsightStrip(holdings);
        updateInvestmentDecisionLayer(holdings, totalValue, totalReturn);
        setupInvestmentSimulator();
        updateInvestmentSimulator(totalValue);
        loadInvestmentGoalsCoverage(totalValue, holdings);
        updateInvestmentRiskPanel(holdings, totalValue);
        updateSectorBreakdown(holdings, totalValue);
        updateDividendTracker(holdings, totalValue);
        loadPortfolioNews(holdings);
        updateRebalancingTool(holdings, totalValue);
        updateTaxInsights(holdings);
        updatePerformanceAttribution(holdings);
        updateBenchmarkComparison(holdings, totalValue, totalInvested);
        updateInvestmentCopilotLayer(holdings, totalValue, totalReturn);
        setupInvestmentReportActions();

        renderHoldingsTable(holdings, totalValue);

    } catch(err) {
        console.log(SHOW_DEMO_DATA ? 'Using demo investment data' : 'Investments data unavailable');
        if (isAuthError(err)) handleUnauthorized();
        if (!SHOW_DEMO_DATA) {
            allInvestmentHoldings = [];
            investmentCurrentTotalValue = 0;

            setText('#inv-total-value', fmt(0));
            setText('#inv-today-change', fmt(0));
            setText('#inv-total-return', fmt(0));
            setText('#inv-total-invested', fmt(0));
            setText('#inv-invested-note', 'Add investments to track cost basis');

            updateAllocationCard([]);
            updateHoldingsInsightStrip([]);
            updateInvestmentDecisionLayer([], 0, 0);
            setupInvestmentSimulator();
            updateInvestmentSimulator(0);
            loadInvestmentGoalsCoverage(0, []);
            updateInvestmentRiskPanel([], 0);
            updateSectorBreakdown([], 0);
            updateDividendTracker([], 0);
            renderPortfolioNews({ news: [], earnings: [], alerts: [] }, []);
            updateRebalancingTool([], 0);
            updateTaxInsights([]);
            updatePerformanceAttribution([]);
            updateBenchmarkComparison([], 0, 0);
            updateInvestmentCopilotLayer([], 0, 0);
            setupInvestmentReportActions();
            renderHoldingsTable([], 0);
            buildPortfolioChart();
        }
    }
}

function getFilteredInvestmentHoldings(holdings) {
    const rows = Array.isArray(holdings) ? holdings : [];
    const filter = currentInvestmentHoldingFilter;

    if (filter === 'Stocks') {
        return rows.filter(holding => String(holding.type || '').toLowerCase() === 'stock');
    }

    if (filter === 'ETFs') {
        return rows.filter(holding => String(holding.type || '').toLowerCase() === 'etf');
    }

    return rows;
}

function renderHoldingsTable(holdings, totalValue) {
    const tbody = document.querySelector('#holdingsTableBody');
    if (!tbody) return;

    const visibleHoldings = getFilteredInvestmentHoldings(holdings);
    updateHoldingsInsightStrip(visibleHoldings);

    if (!visibleHoldings.length) {
        const emptyText = Array.isArray(holdings) && holdings.length
            ? 'Try switching the holdings filter.'
            : 'Add your first investment to see holdings here.';

        tbody.innerHTML = `
            <tr>
                <td colspan="10">
                    <div class="premium-empty-state" style="padding:40px 20px">
                        <div class="premium-empty-state-icon">📈</div>
                        <h3 class="premium-empty-state-title">No holdings found</h3>
                        <p class="premium-empty-state-text">${emptyText}</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = visibleHoldings.map(h => {
            const changeClass = h.day_change_pct >= 0 ? 'positive' : 'negative';
            const gainClass   = h.gain >= 0 ? 'positive' : 'negative';
            const initials    = h.symbol.slice(0, 2);
            const colors      = { AAPL:'#dcfce7;color:#16a34a', VOO:'#dbeafe;color:#1d4ed8', MSFT:'#f3e8ff;color:#7c3aed' };
            const col         = colors[h.symbol] || '#f3f4f6;color:#374151';
            const allocationPct = totalValue > 0 ? (parseFloat(h.total_value || 0) / totalValue) * 100 : 0;
            const fundamentals = getHoldingFundamentals(h.symbol);
            const trend = getHoldingSparkline(h.symbol, h.day_change_pct);
            const sparkline = renderSparkline(trend, changeClass);
            const marketBenchmark = 18;
            const performanceClass = parseFloat(h.gain_pct || 0) >= marketBenchmark ? 'beats-market' : 'under-market';
            const rowBadges = [
                allocationPct > 40 ? '<span class="holding-mini-label high">High weight</span>' : '',
                parseFloat(h.gain_pct || 0) < 0 ? '<span class="holding-mini-label review">Needs review</span>' : ''
            ].filter(Boolean).join('');
            const escapedName = escapeGoalText(h.name);
            const escapedSymbol = escapeGoalText(h.symbol);
            const ratingClass = String(fundamentals.rating || '').toLowerCase();

            return `<tr class="holding-row ${performanceClass}" data-symbol="${escapedSymbol}">
                <td><div class="tx-cell-name">
                    <div class="invest-avatar" style="background:${col.split(';')[0].replace('background:','')};color:${col.split('color:')[1]};border-radius:8px">${initials}</div>
                    <div>
                        <p class="tx-cell-title">${escapedName}</p>
                        <p class="tx-meta" style="font-size:11px">${escapedSymbol}
                            <span class="cat-badge" style="font-size:10px;padding:1px 6px">${h.type}</span>
                            ${rowBadges}
                        </p>
                    </div>
                </div></td>
                <td>${fmt(h.price)}</td>
                <td>${h.shares}</td>
                <td>${fmt(h.avg_cost)}</td>
                <td><strong>${fmt(h.total_value)}</strong></td>
                <td>
                    <span class="holding-gain ${gainClass}">${signedMoney(h.gain)}</span>
                    <span class="holding-gain-pct">${pctText(h.gain_pct)}</span>
                </td>
                <td>${fundamentals.dividendYield}</td>
                <td>${fundamentals.pe}</td>
                <td><span class="analyst-rating ${ratingClass}">${fundamentals.rating}</span></td>
                <td>${sparkline}</td>
            </tr>
            <tr class="holding-detail-row" data-detail-for="${escapedSymbol}" style="display:none">
                <td colspan="10">
                    <div class="holding-detail-drawer">
                        <div>
                            <p class="holding-detail-label">Position</p>
                            <strong>${escapedName}</strong>
                            <span>${escapedSymbol} · ${h.type}</span>
                        </div>
                        <div>
                            <p class="holding-detail-label">Cost Basis</p>
                            <strong>${fmt(parseFloat(h.avg_cost || 0) * parseFloat(h.shares || 0))}</strong>
                            <span>Avg. cost ${fmt(h.avg_cost)} per share</span>
                        </div>
                        <div>
                            <p class="holding-detail-label">Performance</p>
                            <strong class="${gainClass}">${signedMoney(h.gain)} (${pctText(h.gain_pct)})</strong>
                            <span>${performanceClass === 'beats-market' ? 'Beating market benchmark' : 'Under market benchmark'}</span>
                        </div>
                        <div>
                            <p class="holding-detail-label">Research Snapshot</p>
                            <strong>${fundamentals.rating}</strong>
                            <span>Dividend ${fundamentals.dividendYield} · P/E ${fundamentals.pe}</span>
                        </div>
                    </div>
                </td>
            </tr>`;
    }).join('');

    tbody.querySelectorAll('.holding-row').forEach(row => {
        row.addEventListener('click', () => {
            const symbol = row.dataset.symbol;
            const detail = Array.from(tbody.querySelectorAll('.holding-detail-row'))
                .find(item => item.dataset.detailFor === symbol);
            if (!detail) return;

            const isOpen = detail.style.display !== 'none';
            tbody.querySelectorAll('.holding-detail-row').forEach(item => item.style.display = 'none');
            tbody.querySelectorAll('.holding-row').forEach(item => item.classList.remove('expanded'));

            if (!isOpen) {
                detail.style.display = 'table-row';
                row.classList.add('expanded');
            }
        });
    });
}

function getHoldingFundamentals(symbol) {
    const fallback = { dividendYield: '—', pe: '—', rating: 'Hold' };
    const data = {
        AAPL: { dividendYield: '0.4%', pe: '35.8', rating: 'Buy' },
        MSFT: { dividendYield: '0.7%', pe: '31.4', rating: 'Buy' },
        VOO: { dividendYield: '1.2%', pe: '24.6', rating: 'Hold' },
        NVDA: { dividendYield: '0.0%', pe: '47.2', rating: 'Buy' },
        TSLA: { dividendYield: '0.0%', pe: '68.5', rating: 'Hold' },
        META: { dividendYield: '0.4%', pe: '26.1', rating: 'Buy' },
        GOOGL: { dividendYield: '0.5%', pe: '24.3', rating: 'Buy' },
        AMZN: { dividendYield: '0.0%', pe: '38.7', rating: 'Buy' }
    };

    return data[String(symbol || '').toUpperCase()] || fallback;
}

function parsePercentValue(value) {
    const parsed = parseFloat(String(value || '').replace('%', ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function getDividendSchedule(symbol) {
    const fallback = { months: [3, 6, 9, 12] };
    const data = {
        AAPL: { months: [2, 5, 8, 11] },
        MSFT: { months: [3, 6, 9, 12] },
        VOO: { months: [3, 6, 9, 12] },
        NVDA: { months: [3, 6, 9, 12] },
        META: { months: [3, 6, 9, 12] },
        GOOGL: { months: [3, 6, 9, 12] }
    };

    return data[String(symbol || '').toUpperCase()] || fallback;
}

function getNextDividendDate(monthNumber, fromDate = new Date()) {
    const currentYear = fromDate.getFullYear();
    const candidate = new Date(currentYear, monthNumber - 1, 15);
    candidate.setHours(0, 0, 0, 0);

    if (candidate < fromDate) {
        return new Date(currentYear + 1, monthNumber - 1, 15);
    }

    return candidate;
}

function getNextMonthStarts(count = 12, fromDate = new Date()) {
    const months = [];
    const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);

    for (let index = 0; index < count; index += 1) {
        months.push(new Date(start.getFullYear(), start.getMonth() + index, 1));
    }

    return months;
}

function formatDividendDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'No date';

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function buildDividendPayments(holdings) {
    const rows = Array.isArray(holdings) ? holdings : [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return rows.flatMap(holding => {
        const totalValue = parseFloat(holding.total_value || 0);
        const shares = parseFloat(holding.shares || 0);
        const yieldPct = parsePercentValue(getHoldingFundamentals(holding.symbol).dividendYield);
        const annualDividend = totalValue * (yieldPct / 100);
        const schedule = getDividendSchedule(holding.symbol);

        if (!annualDividend || !schedule.months.length || !shares) return [];

        const paymentAmount = annualDividend / schedule.months.length;

        return schedule.months.map(month => ({
            symbol: String(holding.symbol || '').toUpperCase(),
            name: holding.name || holding.symbol || 'Holding',
            shares,
            month,
            date: getNextDividendDate(month, today),
            amount: paymentAmount,
            perShare: shares > 0 ? paymentAmount / shares : 0,
            annualDividend,
            yieldPct
        }));
    }).sort((a, b) => a.date - b.date);
}

function setupDividendSimulator() {
    if (dividendTrackerReady) return;

    ['dividendReinvestYears', 'dividendGrowthRate', 'dividendMonthlyContribution'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', updateDividendReinvestmentSimulator);
        }
    });

    dividendTrackerReady = true;
}

function updateDividendReinvestmentSimulator() {
    const resultEl = document.getElementById('dividendReinvestResult');
    if (!resultEl) return;

    const years = Math.max(parseFloat(document.getElementById('dividendReinvestYears')?.value || 10), 1);
    const growthRate = Math.max(parseFloat(document.getElementById('dividendGrowthRate')?.value || 0), 0) / 100;
    const monthlyContribution = Math.max(parseFloat(document.getElementById('dividendMonthlyContribution')?.value || 0), 0);
    const annualTotal = dividendTrackerState.annualTotal;
    const portfolioYield = dividendTrackerState.portfolioYield / 100;
    const portfolioValue = dividendTrackerState.portfolioValue;

    if (!annualTotal || !portfolioYield) {
        resultEl.textContent = 'Add dividend-paying holdings to estimate reinvested income.';
        return;
    }

    const compoundRate = portfolioYield + growthRate;
    const futurePortfolioValue = portfolioValue +
        (monthlyContribution * years * 12) +
        (annualTotal * ((Math.pow(1 + compoundRate, years) - 1) / Math.max(compoundRate, 0.0001)));
    const projectedAnnualIncome = futurePortfolioValue * portfolioYield * Math.pow(1 + growthRate, years);
    const addedIncome = Math.max(projectedAnnualIncome - annualTotal, 0);

    resultEl.textContent =
        `With ${fmt(monthlyContribution)}/month added and dividends reinvested for ${years} years, annual income could grow from ${fmt(annualTotal)} to about ${fmt(projectedAnnualIncome)}. That is roughly ${fmt(addedIncome)} more per year.`;
}

function updateDividendTracker(holdings, totalValue) {
    const annualEl = document.getElementById('dividendAnnualTotal');
    const annualNoteEl = document.getElementById('dividendAnnualNote');
    const nextAmountEl = document.getElementById('dividendNextPayment');
    const nextDateEl = document.getElementById('dividendNextDate');
    const nextMathEl = document.getElementById('dividendNextMath');
    const receivedTotalEl = document.getElementById('dividendReceivedTotal');
    const receivedNoteEl = document.getElementById('dividendReceivedNote');
    const calendarEl = document.getElementById('dividendCalendarList');
    const calendarTotalEl = document.getElementById('dividendCalendarTotal');
    const badgeEl = document.getElementById('dividendTrackerBadge');

    if (!annualEl && !calendarEl) return;

    const rows = Array.isArray(holdings) ? holdings : [];
    const payments = buildDividendPayments(rows);
    const annualTotal = rows.reduce((sum, holding) => {
        const value = parseFloat(holding.total_value || 0);
        const yieldPct = parsePercentValue(getHoldingFundamentals(holding.symbol).dividendYield);
        return sum + (value * yieldPct / 100);
    }, 0);
    const portfolioYield = totalValue > 0 ? (annualTotal / totalValue) * 100 : 0;

    dividendTrackerState = { annualTotal, portfolioValue: totalValue, portfolioYield };
    setupDividendSimulator();

    if (annualEl) annualEl.textContent = fmt(annualTotal);
    if (annualNoteEl) {
        annualNoteEl.textContent = annualTotal
            ? `Estimated portfolio yield: ${portfolioYield.toFixed(2)}%`
            : 'No dividend income detected yet.';
    }

    if (badgeEl) {
        badgeEl.textContent = annualTotal > 0 ? 'Estimated' : 'No income yet';
        badgeEl.className = `portfolio-score-badge ${annualTotal > 0 ? 'strong' : 'balanced'}`;
    }

    const nextPayment = payments[0];
    if (nextAmountEl) nextAmountEl.textContent = fmt(nextPayment?.amount || 0);
    if (nextDateEl) {
        nextDateEl.textContent = nextPayment
            ? `${nextPayment.symbol} expected around ${formatDividendDate(nextPayment.date)}`
            : 'No upcoming payment found.';
    }
    if (nextMathEl) {
        nextMathEl.textContent = nextPayment
            ? `${fmt(nextPayment.perShare)} per share × ${nextPayment.shares.toLocaleString('en-US')} shares`
            : '';
    }

    if (receivedTotalEl) receivedTotalEl.textContent = fmt(annualTotal * 2.35);
    if (receivedNoteEl) {
        receivedNoteEl.textContent = annualTotal
            ? `Estimated from dividend income since Jan 2024, using current positions.`
            : 'Dividend history will appear once income is detected.';
    }

    if (calendarEl) {
        const monthTotals = new Map();
        payments.forEach(payment => {
            const key = payment.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            const current = monthTotals.get(key) || { amount: 0, symbols: new Set(), date: payment.date };
            current.amount += payment.amount;
            current.symbols.add(payment.symbol);
            monthTotals.set(key, current);
        });

        const nextTwelveMonths = getNextMonthStarts(12).map(date => {
            const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            return [key, monthTotals.get(key) || { amount: 0, symbols: new Set(), date }];
        });
        const nextTwelveMonthTotal = nextTwelveMonths.reduce((sum, [, item]) => sum + item.amount, 0);

        calendarEl.innerHTML = annualTotal
            ? nextTwelveMonths.map(([month, item]) => `
                <div class="dividend-calendar-row ${item.amount > 0 ? '' : 'empty'}">
                    <div>
                        <strong>${escapeGoalText(month)}</strong>
                        <span>${item.amount > 0 ? escapeGoalText(Array.from(item.symbols).join(', ')) : 'No dividends scheduled'}</span>
                    </div>
                    <p>${fmt(item.amount)}</p>
                </div>
            `).join('')
            : '<p class="investment-muted">Add dividend-paying holdings to see payments by month.</p>';

        if (calendarTotalEl) {
            calendarTotalEl.style.display = annualTotal ? 'flex' : 'none';
            calendarTotalEl.innerHTML = `
                <span>Total expected dividends next 12 months</span>
                <strong>${fmt(nextTwelveMonthTotal)}</strong>
            `;
        }
    }

    updateDividendReinvestmentSimulator();
}

function getFallbackPortfolioNews(holdings) {
    const rows = Array.isArray(holdings) ? holdings : [];
    const newsBySymbol = {
        AAPL: {
            title: 'Apple demand and services growth stay in focus',
            source: 'Portfolio Brief',
            summary: 'Relevant because AAPL is a major part of your portfolio and can move your daily returns.',
            impact: 'medium',
            sentiment: 'Bullish',
            published_at: new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString()
        },
        MSFT: {
            title: 'Microsoft earnings may hinge on cloud and AI spending',
            source: 'Earnings Desk',
            summary: 'This is a high-impact watch item because cloud growth can affect MSFT sentiment quickly.',
            impact: 'high',
            sentiment: 'Neutral',
            published_at: new Date(Date.now() - (4 * 60 * 60 * 1000)).toISOString()
        },
        VOO: {
            title: 'S&P 500 investors watch inflation and rate expectations',
            source: 'Index Brief',
            summary: 'Relevant because VOO reflects broad market moves across your portfolio.',
            impact: 'medium',
            sentiment: 'Neutral',
            published_at: new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString()
        }
    };

    return rows.slice(0, 5).map(holding => {
        const symbol = String(holding.symbol || '').toUpperCase();
        const item = newsBySymbol[symbol] || {
            title: `${symbol} portfolio update`,
            source: 'Portfolio Brief',
            summary: 'This update is included because you hold this asset.',
            impact: 'low'
        };

        return {
            symbol,
            name: holding.name || symbol,
            title: item.title,
            source: item.source,
            summary: item.summary,
            impact: item.impact,
            sentiment: item.sentiment,
            published_at: item.published_at,
            url: ''
        };
    });
}

function getFallbackEarnings(holdings) {
    const dates = {
        AAPL: '2026-05-02',
        MSFT: '2026-04-30',
        VOO: null
    };

    return (Array.isArray(holdings) ? holdings : [])
        .map(holding => ({
            symbol: String(holding.symbol || '').toUpperCase(),
            name: holding.name || holding.symbol,
            date: dates[String(holding.symbol || '').toUpperCase()],
            event: dates[String(holding.symbol || '').toUpperCase()] ? 'Earnings' : 'No earnings date'
        }));
}

function formatNewsDate(value) {
    if (!value) return '1d ago';

    const date = typeof value === 'number'
        ? new Date(value * 1000)
        : new Date(value);

    if (Number.isNaN(date.getTime())) return '1d ago';

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function inferPortfolioNewsSymbol(item, holdings) {
    const title = String(item.title || '').toLowerCase();
    const symbols = new Set((Array.isArray(holdings) ? holdings : []).map(h => String(h.symbol || '').toUpperCase()));

    if ((title.includes('microsoft') || title.includes('msft')) && symbols.has('MSFT')) return 'MSFT';
    if ((title.includes('apple') || title.includes('iphone') || title.includes('aapl')) && symbols.has('AAPL')) return 'AAPL';
    if ((title.includes('s&p') || title.includes('index') || title.includes('market')) && symbols.has('VOO')) return 'VOO';

    return String(item.symbol || '').toUpperCase();
}

function getNewsSentiment(item) {
    const explicit = String(item.sentiment || '').toLowerCase();
    if (['bullish', 'bearish', 'neutral'].includes(explicit)) {
        return explicit;
    }

    const title = String(item.title || '').toLowerCase();
    const bullishWords = ['breakout', 'growth', 'rally', 'beat', 'upside', 'strong', 'record'];
    const bearishWords = ['lawsuit', 'miss', 'cut', 'slump', 'drop', 'warning', 'risk', 'probe'];

    if (bullishWords.some(word => title.includes(word))) return 'bullish';
    if (bearishWords.some(word => title.includes(word))) return 'bearish';

    return 'neutral';
}

function renderPortfolioNews(data, holdings) {
    const newsList = document.getElementById('portfolioNewsList');
    const earningsList = document.getElementById('portfolioEarningsList');
    const countEl = document.getElementById('portfolioNewsCount');
    const badgeEl = document.getElementById('portfolioNewsBadge');
    const alertCard = document.getElementById('portfolioNewsAlert');
    const alertTitle = document.getElementById('portfolioNewsAlertTitle');
    const alertText = document.getElementById('portfolioNewsAlertText');

    const news = (Array.isArray(data?.news) && data.news.length ? data.news : getFallbackPortfolioNews(holdings))
        .map(item => ({
            ...item,
            symbol: inferPortfolioNewsSymbol(item, holdings),
            sentiment: getNewsSentiment(item)
        }));
    const earnings = Array.isArray(data?.earnings) && data.earnings.length ? data.earnings : getFallbackEarnings(holdings);
    const alerts = Array.isArray(data?.alerts) ? data.alerts : news.filter(item => item.impact === 'high');

    if (countEl) countEl.textContent = `${news.length} updates`;
    if (badgeEl) {
        badgeEl.textContent = alerts.length ? `${alerts.length} alert${alerts.length === 1 ? '' : 's'}` : 'Watching';
        badgeEl.className = `portfolio-score-badge ${alerts.length ? 'needs-attention' : 'balanced'}`;
    }

    if (alertCard) {
        const topAlert = alerts[0];
        alertCard.style.display = topAlert ? 'block' : 'none';
        if (topAlert && alertTitle && alertText) {
            alertTitle.textContent = topAlert.title || `${topAlert.symbol} needs review`;
            alertText.textContent = topAlert.message || `${topAlert.symbol} has a high-impact update to review.`;
        }
    }

    if (newsList) {
        newsList.innerHTML = news.length
            ? news.map(item => `
                <a class="portfolio-news-item ${item.impact === 'high' ? 'high-impact' : ''}" ${item.url ? `href="${escapeGoalText(item.url)}" target="_blank" rel="noreferrer"` : 'href="#"'}>
                    <div class="portfolio-news-symbol">${escapeGoalText(item.symbol)}</div>
                    <div>
                        <div class="portfolio-news-title-row">
                            <strong>${escapeGoalText(item.title)}</strong>
                            <span>${escapeGoalText(formatNewsDate(item.published_at))}</span>
                        </div>
                        <p>${escapeGoalText(item.summary || 'Relevant because this asset is in your portfolio.')}</p>
                        <div class="portfolio-news-meta">
                            <small>${escapeGoalText(item.source || 'Market source')} · ${escapeGoalText(item.impact || 'medium')} impact</small>
                            <em class="news-sentiment ${escapeGoalText(item.sentiment)}">${escapeGoalText(item.sentiment)}</em>
                        </div>
                    </div>
                </a>
            `).join('')
            : '<p class="investment-muted">Add holdings to see portfolio-specific news.</p>';
    }

    if (earningsList) {
        earningsList.innerHTML = earnings.length
            ? earnings.map(item => `
                <div class="portfolio-earnings-row">
                    <div>
                        <strong>${escapeGoalText(item.symbol)}</strong>
                        <span>${escapeGoalText(item.event || 'Earnings')}</span>
                    </div>
                    <p class="${item.date ? '' : 'muted'}">${item.date ? escapeGoalText(formatDividendDate(new Date(item.date))) : 'No date'}</p>
                </div>
            `).join('')
            : '<p class="investment-muted">No upcoming earnings dates for current ETF-only holdings.</p>';
    }
}

async function loadPortfolioNews(holdings) {
    try {
        const response = await fetch(API + '/investment-news');
        await throwIfNotOk(response, 'Could not load investment news');

        const data = await response.json();
        renderPortfolioNews(data, holdings);
    } catch (error) {
        console.error('Investment news fallback:', error);
        if (isAuthError(error)) {
            handleUnauthorized();
            renderPortfolioNews({ news: [], earnings: [], alerts: [] }, holdings);
            return;
        }

        renderPortfolioNews({
            news: getFallbackPortfolioNews(holdings),
            earnings: getFallbackEarnings(holdings),
            alerts: getFallbackPortfolioNews(holdings).filter(item => item.impact === 'high')
        }, holdings);
    }
}

function getTargetAllocation(symbol) {
    return investmentTargetAllocations[String(symbol || '').toUpperCase()] || 0;
}

function updateRebalancingTool(holdings, totalValue) {
    const list = document.getElementById('rebalanceTargetList');
    const plan = document.getElementById('rebalancePlanCard');
    const rows = Array.isArray(holdings) ? holdings : [];

    if (!list) return;

    if (!rows.length || totalValue <= 0) {
        list.innerHTML = '<p class="investment-muted">Add holdings to compare target and current allocation.</p>';
        if (plan) plan.innerHTML = '<span>Suggested trades</span><p>No holdings available yet.</p>';
        return;
    }

    list.innerHTML = rows.map(holding => {
        const symbol = String(holding.symbol || '').toUpperCase();
        const currentPct = totalValue > 0 ? (parseFloat(holding.total_value || 0) / totalValue) * 100 : 0;
        const targetPct = getTargetAllocation(symbol);
        const gap = currentPct - targetPct;
        const gapClass = Math.abs(gap) < 1 ? 'balanced' : gap > 0 ? 'over' : 'under';

        return `
            <div class="rebalance-row">
                <div>
                    <strong>${escapeGoalText(symbol)}</strong>
                    <span>Current ${currentPct.toFixed(1)}%</span>
                </div>
                <label class="rebalance-target-input">
                    <small>Target</small>
                    <input type="number" min="0" max="100" step="1" value="${targetPct}" data-symbol="${escapeGoalText(symbol)}">
                    <small>%</small>
                </label>
                <div class="rebalance-bar">
                    <span style="width:${Math.min(currentPct, 100)}%"></span>
                </div>
                <em class="${gapClass}">${gap > 0 ? '+' : ''}${gap.toFixed(1)}%</em>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.rebalance-target-input input').forEach(input => {
        input.addEventListener('input', () => {
            const symbol = input.dataset.symbol;
            const value = Math.max(0, Math.min(100, parseFloat(input.value || 0)));
            investmentTargetAllocations[symbol] = value;
            updateRebalancingTool(allInvestmentHoldings, investmentCurrentTotalValue);
        });
    });

    renderRebalancePlan(rows, totalValue, false);
}

function renderRebalancePlan(holdings, totalValue, expanded = true) {
    const plan = document.getElementById('rebalancePlanCard');
    const rows = Array.isArray(holdings) ? holdings : allInvestmentHoldings;
    const value = totalValue || investmentCurrentTotalValue;

    if (!plan) return;

    if (!rows.length || value <= 0) {
        plan.innerHTML = '<span>Suggested trades</span><p>No holdings available yet.</p>';
        return;
    }

    const trades = rows.map(holding => {
        const symbol = String(holding.symbol || '').toUpperCase();
        const targetValue = value * (getTargetAllocation(symbol) / 100);
        const currentValue = parseFloat(holding.total_value || 0);
        const price = parseFloat(holding.price || 0);
        const dollarDiff = targetValue - currentValue;
        const shares = price > 0 ? Math.abs(dollarDiff / price) : 0;

        return {
            symbol,
            action: dollarDiff > 0 ? 'buy' : 'sell',
            amount: Math.abs(dollarDiff),
            shares
        };
    }).filter(item => item.amount >= 25 && item.shares >= 0.01);

    if (!trades.length) {
        plan.innerHTML = '<span>Suggested trades</span><p>Your portfolio is already close to the target allocation.</p>';
        return;
    }

    plan.innerHTML = `
        <span>${expanded ? 'Generated plan' : 'Suggested trades'}</span>
        <ul class="rebalance-trade-list">
            ${trades.map(item => `
                <li class="${item.action}">
                    <strong>${item.action === 'sell' ? 'Sell' : 'Buy'} ${item.shares.toFixed(2)} shares of ${escapeGoalText(item.symbol)}</strong>
                    <span>${item.action === 'sell' ? 'reduce by' : 'add'} ${fmt(item.amount)}</span>
                </li>
            `).join('')}
        </ul>
    `;
}

const generateRebalancePlanBtn = document.getElementById('generateRebalancePlanBtn');
if (generateRebalancePlanBtn) {
    generateRebalancePlanBtn.addEventListener('click', () => {
        renderRebalancePlan(allInvestmentHoldings, investmentCurrentTotalValue, true);
        showToast('Rebalancing plan generated');
    });
}

function getTaxLotInfo(symbol) {
    const data = {
        AAPL: { purchaseDate: '2025-01-15', shortRate: 0.24, longRate: 0.15 },
        MSFT: { purchaseDate: '2025-09-15', shortRate: 0.24, longRate: 0.15 },
        VOO: { purchaseDate: '2026-01-10', shortRate: 0.24, longRate: 0.15 }
    };

    return data[String(symbol || '').toUpperCase()] || { purchaseDate: '2026-01-01', shortRate: 0.24, longRate: 0.15 };
}

function getHoldingPeriodInfo(symbol) {
    const lot = getTaxLotInfo(symbol);
    const purchaseDate = new Date(lot.purchaseDate);
    const today = new Date();
    const longTermDate = new Date(purchaseDate);
    longTermDate.setFullYear(longTermDate.getFullYear() + 1);

    const isLongTerm = today > longTermDate;
    const daysUntilLongTerm = Math.max(0, Math.ceil((longTermDate - today) / (1000 * 60 * 60 * 24)));

    return { ...lot, purchaseDate, longTermDate, isLongTerm, daysUntilLongTerm };
}

function updateTaxInsights(holdings) {
    const shortEl = document.getElementById('taxShortTermGain');
    const longEl = document.getElementById('taxLongTermGain');
    const shortRateEl = document.getElementById('taxShortTermRate');
    const longRateEl = document.getElementById('taxLongTermRate');
    const list = document.getElementById('taxInsightList');
    const rows = Array.isArray(holdings) ? holdings : [];

    let shortGain = 0;
    let longGain = 0;

    const enriched = rows.map(holding => {
        const gain = parseFloat(holding.gain || 0);
        const taxInfo = getHoldingPeriodInfo(holding.symbol);

        if (taxInfo.isLongTerm) {
            longGain += gain;
        } else {
            shortGain += gain;
        }

        return { ...holding, gain, taxInfo };
    });

    if (shortEl) shortEl.textContent = fmt(shortGain);
    if (longEl) longEl.textContent = fmt(longGain);
    if (shortRateEl) shortRateEl.textContent = 'Taxed at ~24% ordinary income';
    if (longRateEl) longRateEl.textContent = 'Taxed at ~15% preferential rate';

    if (!list) return;

    if (!enriched.length) {
        list.innerHTML = '<p class="investment-muted">Add holdings to see tax insights.</p>';
        return;
    }

    const topGain = enriched.filter(item => item.gain > 0).sort((a, b) => b.gain - a.gain)[0];
    const topLoss = enriched.filter(item => item.gain < 0).sort((a, b) => a.gain - b.gain)[0];
    const waitCandidate = enriched
        .filter(item => !item.taxInfo.isLongTerm && item.gain > 0)
        .sort((a, b) => a.taxInfo.daysUntilLongTerm - b.taxInfo.daysUntilLongTerm)[0];
    const topTax = topGain
        ? topGain.gain * (topGain.taxInfo.isLongTerm ? topGain.taxInfo.longRate : topGain.taxInfo.shortRate)
        : 0;

    const insights = [];

    if (topGain) {
        insights.push(`
            <div class="tax-insight-row">
                <span>Sell today estimate</span>
                <strong>If you sell ${escapeGoalText(topGain.symbol)} today, estimated tax could be ${fmt(topTax)}.</strong>
                <p>Uses an assumed ${topGain.taxInfo.isLongTerm ? 'long-term' : 'short-term'} capital gains rate.</p>
            </div>
        `);
    }

    insights.push(`
            <div class="tax-insight-row">
                <span>Gain type</span>
                <strong>${fmt(shortGain)} short-term · ${fmt(longGain)} long-term</strong>
                <p>Short-term gains are generally taxed more heavily than long-term gains.</p>
            </div>
    `);

    if (topLoss && topGain) {
        insights.push(`
            <div class="tax-insight-row">
                <span>Tax loss harvesting</span>
                <strong>Selling ${escapeGoalText(topLoss.symbol)} could offset part of your ${escapeGoalText(topGain.symbol)} gains.</strong>
                <p>Check wash sale rules before acting.</p>
            </div>
        `);
    } else {
        insights.push(`
            <div class="tax-insight-row">
                <span>Tax loss harvesting</span>
                <strong>No loss-harvesting candidate found right now.</strong>
                <p>Your current demo holdings are showing unrealized gains.</p>
            </div>
        `);
    }

    if (waitCandidate) {
        insights.push(`
            <div class="tax-insight-row">
                <span>Best time to sell</span>
                <strong>Consider waiting until ${formatDividendDate(waitCandidate.taxInfo.longTermDate)} for ${escapeGoalText(waitCandidate.symbol)}.</strong>
                <p>That is when this estimated lot becomes long-term.</p>
            </div>
        `);
    } else {
        insights.push(`
            <div class="tax-insight-row">
                <span>Best time to sell</span>
                <strong>Your largest gain already appears long-term.</strong>
                <p>Still confirm exact lots before selling.</p>
            </div>
        `);
    }

    list.innerHTML = insights.join('');
}

function getMonthlyContributionShare(symbol) {
    const shares = {
        AAPL: 0.052,
        MSFT: -0.018,
        VOO: 0.026
    };

    return shares[String(symbol || '').toUpperCase()] || 0.02;
}

function updatePerformanceAttribution(holdings) {
    const list = document.getElementById('performanceAttributionList');
    const totalEl = document.getElementById('performanceAttributionTotal');
    const bestDayEl = document.getElementById('performanceBestDay');
    const worstDayEl = document.getElementById('performanceWorstDay');
    const bestMonthEl = document.getElementById('performanceBestMonth');
    const rows = Array.isArray(holdings) ? holdings : [];

    if (!list) return;

    if (!rows.length) {
        list.innerHTML = '<p class="investment-muted">Add holdings to see monthly performance attribution.</p>';
        return;
    }

    const attribution = rows.map(holding => {
        const value = parseFloat(holding.total_value || 0);
        const monthlyReturn = getMonthlyContributionShare(holding.symbol);
        const contribution = value * monthlyReturn;

        return {
            symbol: String(holding.symbol || '').toUpperCase(),
            name: holding.name || holding.symbol,
            contribution,
            monthlyReturn: monthlyReturn * 100
        };
    }).sort((a, b) => b.contribution - a.contribution);

    const totalContribution = attribution.reduce((sum, item) => sum + item.contribution, 0);
    const maxContribution = Math.max(...attribution.map(item => Math.abs(item.contribution)), 1);

    if (totalEl) {
        totalEl.classList.toggle('negative', totalContribution < 0);
        totalEl.innerHTML = `
            <span>Total this month</span>
            <strong>Your portfolio ${totalContribution >= 0 ? 'gained' : 'lost'} ${signedMoney(totalContribution)} this month</strong>
        `;
    }

    list.innerHTML = attribution.map(item => `
        <div class="attribution-row ${item.contribution >= 0 ? 'positive' : 'negative'}">
            <div>
                <strong>${escapeGoalText(item.symbol)} contributed ${signedMoney(item.contribution)}</strong>
                <span>${escapeGoalText(item.name)} · ${pctText(item.monthlyReturn)} this month</span>
            </div>
            <div class="attribution-bar">
                <span style="width:${Math.min((Math.abs(item.contribution) / maxContribution) * 100, 100)}%"></span>
            </div>
        </div>
    `).join('');

    if (bestDayEl) bestDayEl.textContent = `Apr 24 · ${signedMoney(totalContribution * 0.26)}`;
    if (worstDayEl) worstDayEl.textContent = `Apr 10 · ${signedMoney(-Math.abs(totalContribution * 0.14))}`;
    if (bestMonthEl) bestMonthEl.textContent = `April · ${signedMoney(totalContribution)}`;
}

function getBenchmarkReturns() {
    return [
        { label: '1M', portfolio: 2.7, benchmark: 1.4 },
        { label: '3M', portfolio: 9.4, benchmark: 5.5 },
        { label: '1Y', portfolio: 34.2, benchmark: 25.3 }
    ];
}

function updateBenchmarkComparison(holdings, totalValue, totalInvested) {
    const gapCard = document.getElementById('benchmarkGapCard');
    const rangeList = document.getElementById('benchmarkRangeList');
    const badge = document.getElementById('benchmarkStatusBadge');
    const rows = Array.isArray(holdings) ? holdings : [];

    if (!gapCard || !rangeList) return;

    if (!rows.length || totalInvested <= 0) {
        gapCard.innerHTML = '<span>S&P 500 gap</span><strong>No comparison yet.</strong><p>Add holdings to benchmark your portfolio.</p>';
        rangeList.innerHTML = '<p class="investment-muted">Add holdings to compare 1M, 3M, and 1Y performance.</p>';
        return;
    }

    const ranges = getBenchmarkReturns();
    const oneYear = ranges.find(item => item.label === '1Y') || ranges[ranges.length - 1];
    const dollarGap = totalInvested * ((oneYear.portfolio - oneYear.benchmark) / 100);
    const gapClass = dollarGap >= 0 ? 'positive' : 'negative';

    if (badge) {
        badge.textContent = dollarGap >= 0 ? 'Beating VOO' : 'Trailing VOO';
        badge.className = `portfolio-score-badge ${dollarGap >= 0 ? 'strong' : 'needs-attention'}`;
    }

    gapCard.className = `benchmark-gap-card ${gapClass}`;
    gapCard.innerHTML = `
        <span>S&P 500 gap</span>
        <strong>${dollarGap >= 0 ? 'You made' : 'You made'} ${fmt(dollarGap)} ${dollarGap >= 0 ? 'more' : 'less'} than if you just bought VOO</strong>
        <p>Based on the same ${oneYear.label} rolling comparison shown below.</p>
    `;

    rangeList.innerHTML = ranges.map(item => {
        const gap = item.portfolio - item.benchmark;
        const beat = gap >= 0;

        return `
            <div class="benchmark-range-row ${beat ? 'positive' : 'negative'}">
                <strong>${item.label}</strong>
                <span>Portfolio ${pctText(item.portfolio)}</span>
                <span>S&P 500 ${pctText(item.benchmark)}</span>
                <em>${beat ? '+' : ''}${gap.toFixed(1)}%</em>
            </div>
        `;
    }).join('');
}

function getInvestmentReportSnapshot() {
    const rows = Array.isArray(allInvestmentHoldings) ? allInvestmentHoldings : [];
    const totalValue = investmentCurrentTotalValue || rows.reduce((sum, holding) => sum + parseFloat(holding.total_value || 0), 0);
    const totalCost = rows.reduce((sum, holding) => {
        const shares = parseFloat(holding.shares || 0);
        const avgCost = parseFloat(holding.avg_cost || 0);
        return sum + (shares * avgCost);
    }, 0);
    const totalGain = rows.reduce((sum, holding) => sum + parseFloat(holding.gain || 0), 0);
    const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
    const best = rows.slice().sort((a, b) => parseFloat(b.gain_pct || 0) - parseFloat(a.gain_pct || 0))[0];
    const worst = rows.slice().sort((a, b) => parseFloat(a.gain_pct || 0) - parseFloat(b.gain_pct || 0))[0];
    const dividendAnnual = dividendTrackerState.annualTotal || rows.reduce((sum, holding) => {
        const yieldPct = parsePercentValue(getHoldingFundamentals(holding.symbol).dividendYield);
        return sum + (parseFloat(holding.total_value || 0) * yieldPct);
    }, 0);

    return { rows, totalValue, totalCost, totalGain, totalGainPct, best, worst, dividendAnnual };
}

function buildInvestmentReportHtml(type = 'monthly') {
    const snapshot = getInvestmentReportSnapshot();
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const title = type === 'annual' ? 'Annual Performance Summary' : 'Monthly Portfolio Report';
            const rows = snapshot.rows.map(holding => `
        <tr>
            <td>${escapeGoalText(holding.symbol)}</td>
            <td>${escapeGoalText(holding.name)}</td>
            <td>${fmt(holding.avg_cost)}</td>
            <td>${fmt(holding.total_value)}</td>
            <td>${signedMoney(holding.gain)}</td>
            <td>${pctText(holding.gain_pct)}</td>
            <td>${getHoldingFundamentals(holding.symbol).rating}</td>
        </tr>
    `).join('');

    return `
        <!doctype html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: Inter, Arial, sans-serif; color:#111827; margin:0; background:#f8fafc; }
                .page { padding:32px; }
                .brand-bar { height:8px; background:linear-gradient(90deg,#10b981,#14b8a6); }
                .report-header {
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:20px;
                    padding:24px 32px;
                    background:#ffffff;
                    border-bottom:1px solid #e5e7eb;
                }
                .brand {
                    display:flex;
                    align-items:center;
                    gap:12px;
                    color:#111827;
                    font-weight:900;
                    font-size:18px;
                }
                .brand-mark {
                    width:38px;
                    height:38px;
                    border-radius:12px;
                    display:inline-flex;
                    align-items:center;
                    justify-content:center;
                    background:linear-gradient(135deg,#10b981,#3b82f6);
                    color:#fff;
                    font-size:20px;
                    font-weight:900;
                }
                .report-date { color:#667085; font-size:12px; font-weight:800; }
                h1 { margin:0 0 6px; font-size:28px; }
                .muted { color:#667085; margin:0 0 24px; }
                .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin:24px 0; }
                .card { border:1px solid #e5e7eb; border-radius:16px; padding:16px; background:#fff; }
                .card span { display:block; color:#667085; font-size:12px; font-weight:700; }
                .card strong { display:block; margin-top:8px; font-size:22px; }
                table { width:100%; border-collapse:collapse; margin-top:18px; background:#fff; border-radius:16px; overflow:hidden; }
                th, td { padding:12px; border-bottom:1px solid #e5e7eb; text-align:left; font-size:13px; }
                th { color:#667085; font-size:11px; text-transform:uppercase; }
                .note { margin-top:24px; color:#667085; font-size:12px; line-height:1.5; }
                @media print { button { display:none; } body { background:#fff; } .page { padding:20px; } }
            </style>
        </head>
        <body>
            <div class="brand-bar"></div>
            <div class="report-header">
                <div class="brand"><span class="brand-mark">↗</span><span>FinTrack</span></div>
                <div class="report-date">${today}</div>
            </div>
            <main class="page">
                <h1>${title}</h1>
                <p class="muted">Professional portfolio summary generated by FinTrack.</p>
                <div class="grid">
                    <div class="card"><span>Portfolio value</span><strong>${fmt(snapshot.totalValue)}</strong></div>
                    <div class="card"><span>Total profit</span><strong>${signedMoney(snapshot.totalGain)}</strong></div>
                    <div class="card"><span>Total return</span><strong>${pctText(snapshot.totalGainPct)}</strong></div>
                    <div class="card"><span>Annual dividends</span><strong>${fmt(snapshot.dividendAnnual)}</strong></div>
                </div>
                <p><strong>Best holding:</strong> ${snapshot.best ? `${escapeGoalText(snapshot.best.symbol)} ${pctText(snapshot.best.gain_pct)}` : 'Not available'}</p>
                <p><strong>Watch item:</strong> ${snapshot.worst ? `${escapeGoalText(snapshot.worst.symbol)} ${pctText(snapshot.worst.gain_pct)}` : 'Not available'}</p>
                <table>
                    <thead><tr><th>Symbol</th><th>Name</th><th>Avg Cost</th><th>Value</th><th>Gain</th><th>Return</th><th>Rating</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="7">No holdings available.</td></tr>'}</tbody>
                </table>
                <p class="note">Educational summary only. Market data, tax estimates, and ratings should be verified before making financial decisions.</p>
            </main>
        </body>
        </html>
    `;
}

function openMonthlyPortfolioReport() {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
        showToast('Allow popups to preview the report');
        return;
    }

    reportWindow.document.write(buildInvestmentReportHtml('monthly'));
    reportWindow.document.close();
    reportWindow.focus();
    setTimeout(() => reportWindow.print(), 350);
}

function downloadAnnualPerformanceSummary() {
    const today = new Date().toISOString().split('T')[0];
    const html = buildInvestmentReportHtml('annual');
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fintrack-annual-performance-${today}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function exportInvestmentTaxCSV() {
    const rows = Array.isArray(allInvestmentHoldings) ? allInvestmentHoldings : [];
    if (!rows.length) {
        showToast('No holdings available to export');
        return;
    }

    const escapeCSV = value => {
        const str = String(value ?? '');
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const headers = [
        'Symbol',
        'Name',
        'Shares',
        'Avg Cost',
        'Current Price',
        'Cost Basis',
        'Market Value',
        'Unrealized Gain',
        'Gain Percent',
        'Purchase Date',
        'Gain Type',
        'Estimated Tax Rate',
        'Estimated Tax'
    ];
    const csvRows = rows.map(holding => {
        const shares = parseFloat(holding.shares || 0);
        const avgCost = parseFloat(holding.avg_cost || 0);
        const price = parseFloat(holding.price || 0);
        const costBasis = shares * avgCost;
        const marketValue = shares * price;
        const gain = parseFloat(holding.gain || (marketValue - costBasis));
        const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0;
        const taxInfo = getHoldingPeriodInfo(holding.symbol);
        const rate = taxInfo.isLongTerm ? taxInfo.longRate : taxInfo.shortRate;

        return [
            holding.symbol,
            holding.name,
            shares,
            avgCost.toFixed(2),
            price.toFixed(2),
            costBasis.toFixed(2),
            marketValue.toFixed(2),
            gain.toFixed(2),
            gainPct.toFixed(2),
            taxInfo.purchaseDate.toISOString().slice(0, 10),
            taxInfo.isLongTerm ? 'Long-term' : 'Short-term',
            `${(rate * 100).toFixed(0)}%`,
            Math.max(gain * rate, 0).toFixed(2)
        ].map(escapeCSV).join(',');
    });

    const today = new Date().toISOString().split('T')[0];
    downloadCSVFile(`fintrack-investment-tax-lots-${today}.csv`, [headers.join(','), ...csvRows].join('\n'));
    showToast('Tax CSV exported');
}

function exportPortfolioShareImage() {
    const snapshot = getInvestmentReportSnapshot();
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 675;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 1200, 675);
    gradient.addColorStop(0, '#ecfdf5');
    gradient.addColorStop(1, '#eff6ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.roundRect(70, 70, 1060, 535, 34);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.font = '800 42px Inter, Arial';
    ctx.fillText('FinTrack Portfolio Wrapped', 110, 135);
    ctx.fillStyle = '#64748b';
    ctx.font = '700 22px Inter, Arial';
    ctx.fillText('Your investing snapshot', 110, 172);

    ctx.fillStyle = '#10b981';
    ctx.font = '900 74px Inter, Arial';
    ctx.fillText(fmt(snapshot.totalValue), 110, 285);
    ctx.fillStyle = '#111827';
    ctx.font = '800 28px Inter, Arial';
    ctx.fillText('Portfolio value', 115, 330);

    ctx.fillStyle = snapshot.totalGain >= 0 ? '#10b981' : '#ef4444';
    ctx.font = '900 42px Inter, Arial';
    ctx.fillText(`${signedMoney(snapshot.totalGain)} (${pctText(snapshot.totalGainPct)})`, 110, 410);
    ctx.fillStyle = '#64748b';
    ctx.font = '700 20px Inter, Arial';
    ctx.fillText('Total profit since purchase cost', 115, 444);

    ctx.fillStyle = '#111827';
    ctx.font = '800 28px Inter, Arial';
    ctx.fillText(`Best holding: ${snapshot.best ? `${snapshot.best.symbol} ${pctText(snapshot.best.gain_pct)}` : 'N/A'}`, 680, 255);
    ctx.fillText(`Annual dividends: ${fmt(snapshot.dividendAnnual)}`, 680, 315);
    ctx.fillText(`Holdings tracked: ${snapshot.rows.length}`, 680, 375);

    ctx.fillStyle = '#64748b';
    ctx.font = '700 18px Inter, Arial';
    ctx.fillText('Educational summary only. Generated in FinTrack.', 110, 555);

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `fintrack-portfolio-wrapped-${new Date().toISOString().split('T')[0]}.png`;
    link.click();
    showToast('Share image exported');
}

function setupInvestmentReportActions() {
    const actions = [
        ['monthlyPortfolioReportBtn', openMonthlyPortfolioReport],
        ['annualPerformanceReportBtn', downloadAnnualPerformanceSummary],
        ['taxDocumentExportBtn', exportInvestmentTaxCSV],
        ['portfolioShareImageBtn', exportPortfolioShareImage]
    ];

    actions.forEach(([id, handler]) => {
        const button = document.getElementById(id);
        if (!button || button.dataset.bound === 'true') return;
        button.dataset.bound = 'true';
        button.addEventListener('click', handler);
    });
}

function getInvestmentRedFlags(holdings, totalValue) {
    const rows = Array.isArray(holdings) ? holdings : [];
    const flags = [];

    rows.forEach(holding => {
        const symbol = String(holding.symbol || '').toUpperCase();
        const allocation = totalValue > 0 ? (parseFloat(holding.total_value || 0) / totalValue) * 100 : 0;
        const dayChange = parseFloat(holding.day_change_pct || 0);
        const target = getTargetAllocation(symbol);
        const drift = allocation - target;

        if (allocation > 40) {
            flags.push({
                tone: 'warning',
                title: `${symbol} concentration is high`,
                text: `${symbol} is ${allocation.toFixed(1)}% of your portfolio.`
            });
        }

        if (dayChange <= -3) {
            flags.push({
                tone: 'danger',
                title: `${symbol} dropped ${Math.abs(dayChange).toFixed(1)}% today`,
                text: 'Review news and earnings before adding more.'
            });
        }

        if (Math.abs(drift) > 5) {
            flags.push({
                tone: 'warning',
                title: `${symbol} drifted ${Math.abs(drift).toFixed(1)}% from target`,
                text: 'A rebalance reminder is active.'
            });
        }
    });

    return flags;
}

function getInvestmentAlerts(holdings, totalValue) {
    const rows = Array.isArray(holdings) ? holdings : [];
    const alerts = [];
    const totalDayChange = rows.reduce((sum, holding) => {
        const value = parseFloat(holding.total_value || 0);
        const pct = parseFloat(holding.day_change_pct || 0);
        return sum + (value * pct / 100);
    }, 0);
    const portfolioDropPct = totalValue > 0 ? (totalDayChange / totalValue) * 100 : 0;

    if (portfolioDropPct <= -3) {
        alerts.push({
            type: 'drop',
            title: 'Portfolio drop alert',
            text: `Your portfolio dropped ${Math.abs(portfolioDropPct).toFixed(1)}% today.`
        });
    }

    rows.forEach(holding => {
        const symbol = String(holding.symbol || '').toUpperCase();
        const price = parseFloat(holding.price || 0);
        const target = symbol === 'AAPL' ? 300 : symbol === 'MSFT' ? 450 : 700;
        const allocation = totalValue > 0 ? (parseFloat(holding.total_value || 0) / totalValue) * 100 : 0;
        const drift = Math.abs(allocation - getTargetAllocation(symbol));

        alerts.push({
            type: 'price',
            title: `${symbol} price alert`,
            text: price >= target
                ? `${symbol} hit ${fmt(target)}. Current price is ${fmt(price)}.`
                : `Notify when ${symbol} hits ${fmt(target)}. Current price is ${fmt(price)}.`
        });

        if (symbol === 'AAPL') {
            alerts.push({
                type: 'earnings',
                title: 'AAPL earnings reminder',
                text: 'AAPL reports earnings in 3 days.'
            });
        }

        if (drift > 5) {
            alerts.push({
                type: 'rebalance',
                title: `${symbol} rebalance reminder`,
                text: `${symbol} allocation drift is ${drift.toFixed(1)}%, above your 5% reminder threshold.`
            });
        }
    });

    return alerts.slice(0, 7);
}

function renderInvestmentAlerts() {
    const alertList = document.getElementById('investmentAlertList');
    const alertBadge = document.getElementById('investmentAlertBadge');
    if (!alertList) return;

    if (alertBadge) {
        alertBadge.textContent = `${investmentAlertsState.length} alert${investmentAlertsState.length === 1 ? '' : 's'}`;
        alertBadge.className = `portfolio-score-badge ${investmentAlertsState.length ? 'needs-attention' : 'strong'}`;
    }

    if (!investmentAlertsState.length) {
        alertList.innerHTML = '<p class="investment-muted">No alerts are active right now.</p>';
        return;
    }

    const visibleAlerts = investmentAlertsExpanded ? investmentAlertsState : investmentAlertsState.slice(0, 4);
    const hiddenCount = Math.max(investmentAlertsState.length - visibleAlerts.length, 0);

    alertList.innerHTML = `
        <div class="investment-alert-scroll ${investmentAlertsExpanded ? 'expanded' : ''}">
            ${visibleAlerts.map((alert, index) => `
                <div class="investment-alert-row ${escapeGoalText(alert.type)}">
                    <button
                        type="button"
                        class="investment-alert-dismiss"
                        data-alert-index="${index}"
                        aria-label="Dismiss alert"
                    >×</button>
                    <strong>${escapeGoalText(alert.title)}</strong>
                    <span>${escapeGoalText(alert.text)}</span>
                </div>
            `).join('')}
        </div>
        ${hiddenCount ? `
            <button type="button" class="investment-alert-view-all" id="investmentAlertViewAll">
                View all ${investmentAlertsState.length} alerts
            </button>
        ` : investmentAlertsExpanded && investmentAlertsState.length > 4 ? `
            <button type="button" class="investment-alert-view-all" id="investmentAlertViewAll">
                Show fewer alerts
            </button>
        ` : ''}
    `;
}

function updateInvestmentCopilotLayer(holdings, totalValue, totalReturn) {
    const reportEl = document.getElementById('weeklyPortfolioReport');
    const flagsEl = document.getElementById('investmentRedFlags');
    const alertList = document.getElementById('investmentAlertList');
    const alertBadge = document.getElementById('investmentAlertBadge');
    const rows = Array.isArray(holdings) ? holdings : [];

    if (!rows.length) return;

    const flags = getInvestmentRedFlags(rows, totalValue);
    const alerts = getInvestmentAlerts(rows, totalValue);
    investmentAlertsState = alerts;

    const largest = rows
        .map(holding => ({
            symbol: String(holding.symbol || '').toUpperCase(),
            value: parseFloat(holding.total_value || 0),
            pct: totalValue > 0 ? (parseFloat(holding.total_value || 0) / totalValue) * 100 : 0
        }))
        .sort((a, b) => b.pct - a.pct)[0];

    if (reportEl) {
        reportEl.textContent =
            `This week your portfolio is ${totalReturn >= 0 ? 'up overall' : 'down overall'}, led by ${largest.symbol} at ${largest.pct.toFixed(1)}% of total value. ${flags.length ? 'Main focus: review concentration and rebalance drift.' : 'No major red flags detected.'}`;
    }

    if (flagsEl) {
        flagsEl.classList.toggle('clean', flags.length === 0);
        flagsEl.innerHTML = flags.length
            ? `
                <span>Red flags detected</span>
                ${flags.slice(0, 3).map(flag => `<p><strong>${escapeGoalText(flag.title)}</strong> ${escapeGoalText(flag.text)}</p>`).join('')}
            `
            : '<span>No red flags</span><p>Your portfolio looks stable based on current demo checks.</p>';
    }

    if (alertList || alertBadge) renderInvestmentAlerts();
}

function formatInvestmentCopilotAnswer(answer) {
    if (!answer) return '';

    return answer
        .replace(/\* /g, '• ')
        .replace(/Short answer:/gi, '<h4>Short answer</h4><p>')
        .replace(/Why:/gi, '</p><h4>Why</h4><p>')
        .replace(/Next move:/gi, '</p><h4>Next move</h4><p>')
        .replace(/\n- /g, '<br>• ')
        .replace(/\n• /g, '<br>• ')
        .replace(/\n/g, '<br>') + '</p>';
}

const investmentCopilotAskBtn = document.getElementById('investmentCopilotAskBtn');
if (investmentCopilotAskBtn) {
    investmentCopilotAskBtn.addEventListener('click', async () => {
        const input = document.getElementById('investmentCopilotInput');
        const answerEl = document.getElementById('investmentCopilotAnswer');
        const question = input ? input.value.trim() : '';

        if (!question) {
            showToast('Ask the Copilot a portfolio question first');
            return;
        }

        investmentCopilotAskBtn.disabled = true;
        investmentCopilotAskBtn.textContent = 'Thinking...';

        try {
            const response = await fetch(API + '/investment-copilot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question,
                    holdings: allInvestmentHoldings,
                    goals: allGoals,
                    alerts: investmentAlertsState
                })
            });
            await throwIfNotOk(response, 'Copilot failed');
            const data = await response.json();

            if (answerEl) {
                answerEl.innerHTML = `<span>Copilot</span>${formatInvestmentCopilotAnswer(data.answer)}`;
            }
        } catch (error) {
            console.error('Investment Copilot error:', error);
            if (isAuthError(error)) handleUnauthorized();
            if (answerEl) {
                answerEl.innerHTML = `
                    <span>Copilot</span>
                    <h4>Short answer</h4>
                    <p>Review before acting.</p>
                    <h4>Why</h4>
                    <p>• The Copilot could not connect right now.<br>• Use allocation, risk, tax, and earnings context before selling.</p>
                    <h4>Next move</h4>
                    <p>Check MSFT concentration, tax impact, and upcoming earnings before trading.</p>
                `;
            }
        } finally {
            investmentCopilotAskBtn.disabled = false;
            investmentCopilotAskBtn.textContent = 'Ask';
        }
    });
}

document.querySelectorAll('.copilot-suggestion-btn').forEach(button => {
    button.addEventListener('click', () => {
        const input = document.getElementById('investmentCopilotInput');
        if (!input) return;

        input.value = button.textContent.trim();
        input.focus();
    });
});

document.addEventListener('click', event => {
    const dismissBtn = event.target.closest('.investment-alert-dismiss');
    if (dismissBtn) {
        const index = Number(dismissBtn.dataset.alertIndex);
        if (!Number.isNaN(index)) {
            investmentAlertsState.splice(index, 1);
            renderInvestmentAlerts();
            showToast('Alert dismissed');
        }
        return;
    }

    const viewAllBtn = event.target.closest('#investmentAlertViewAll');
    if (viewAllBtn) {
        investmentAlertsExpanded = !investmentAlertsExpanded;
        renderInvestmentAlerts();
    }
});

const addPriceAlertBtn = document.getElementById('addPriceAlertBtn');
if (addPriceAlertBtn) {
    addPriceAlertBtn.addEventListener('click', () => {
        const symbol = document.getElementById('priceAlertSymbol')?.value || 'AAPL';
        const target = parseFloat(document.getElementById('priceAlertTarget')?.value || 0);

        if (!target || target <= 0) {
            showToast('Enter a valid alert price');
            return;
        }

        investmentAlertsState.unshift({
            type: 'price',
            title: `${symbol} price alert`,
            text: `Notify when ${symbol} hits ${fmt(target)}.`
        });

        renderInvestmentAlerts();
        showToast(`${symbol} price alert added`);
    });
}

function getHoldingRiskMetrics(symbol) {
    const fallback = { beta: 1.0, volatility: 18, maxDrawdown: -12, sharpe: 0.8 };
    const data = {
        AAPL: { beta: 1.18, volatility: 23, maxDrawdown: -16, sharpe: 1.05 },
        MSFT: { beta: 0.92, volatility: 19, maxDrawdown: -13, sharpe: 1.12 },
        VOO: { beta: 1.00, volatility: 14, maxDrawdown: -9, sharpe: 0.94 },
        NVDA: { beta: 1.78, volatility: 38, maxDrawdown: -28, sharpe: 1.22 },
        TSLA: { beta: 2.05, volatility: 46, maxDrawdown: -35, sharpe: 0.62 },
        META: { beta: 1.24, volatility: 29, maxDrawdown: -21, sharpe: 1.02 },
        GOOGL: { beta: 1.05, volatility: 24, maxDrawdown: -18, sharpe: 0.96 },
        AMZN: { beta: 1.31, volatility: 30, maxDrawdown: -23, sharpe: 0.88 }
    };

    return data[String(symbol || '').toUpperCase()] || fallback;
}

function getHoldingSector(symbol) {
    const sectors = {
        AAPL: 'Technology',
        MSFT: 'Technology',
        NVDA: 'Technology',
        TSLA: 'Consumer',
        META: 'Communication',
        GOOGL: 'Communication',
        AMZN: 'Consumer',
        VOO: 'Broad Market'
    };

    return sectors[String(symbol || '').toUpperCase()] || 'Other';
}

function getSectorExposureForHolding(holding, value) {
    const symbol = String(holding.symbol || '').toUpperCase();

    if (symbol === 'VOO') {
        return {
            Technology: value * 0.29,
            Finance: value * 0.13,
            Healthcare: value * 0.12,
            Consumer: value * 0.10,
            Energy: value * 0.04,
            'Broad Market': value * 0.32
        };
    }

    return {
        [getHoldingSector(symbol)]: value
    };
}

function getSectorColor(sector) {
    const colors = {
        Technology: '#10b981',
        Finance: '#3b82f6',
        Healthcare: '#8b5cf6',
        Consumer: '#f97316',
        Communication: '#14b8a6',
        Industrials: '#64748b',
        Energy: '#f59e0b',
        'Broad Market': '#94a3b8',
        Other: '#cbd5e1'
    };

    return colors[sector] || colors.Other;
}

function updateSectorBreakdown(holdings, totalValue) {
    const canvas = document.getElementById('sectorBreakdownChart');
    const compareList = document.getElementById('sectorCompareList');
    const insightText = document.getElementById('sectorInsightText');
    const insightBadge = document.getElementById('sectorInsightBadge');
    const rows = Array.isArray(holdings) ? holdings : [];

    if (!canvas || !compareList || !insightText || !insightBadge) return;

    const benchmark = {
        Technology: 29,
        Finance: 13,
        Healthcare: 12,
        Consumer: 10,
        Communication: 8,
        Industrials: 8,
        Energy: 4,
        Other: 16
    };

    if (!rows.length || totalValue <= 0) {
        if (window.sectorChart) window.sectorChart.destroy();
        compareList.innerHTML = '';
        insightText.textContent = 'Add investments to see sector exposure.';
        insightBadge.textContent = 'No data';
        return;
    }

    const sectorTotals = {};
    rows.forEach(holding => {
        const value = parseFloat(holding.total_value || 0);
        const exposure = getSectorExposureForHolding(holding, value);

        Object.entries(exposure).forEach(([sector, sectorValue]) => {
            sectorTotals[sector] = (sectorTotals[sector] || 0) + sectorValue;
        });
    });

    const sectors = Object.entries(sectorTotals)
        .map(([sector, value]) => ({
            sector,
            pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
            benchmark: benchmark[sector] || benchmark.Other
        }))
        .sort((a, b) => b.pct - a.pct);

    const largestGap = sectors.reduce((top, item) => {
        const gap = item.pct - item.benchmark;
        return Math.abs(gap) > Math.abs(top.gap)
            ? { sector: item.sector, gap, pct: item.pct, benchmark: item.benchmark }
            : top;
    }, { sector: '', gap: 0, pct: 0, benchmark: 0 });

    const gapText = Math.abs(largestGap.gap).toFixed(1);
    const direction = largestGap.gap >= 0 ? 'overweight' : 'underweight';

    insightBadge.textContent = `${direction === 'overweight' ? 'Overweight' : 'Underweight'}`;
    insightBadge.className = `portfolio-score-badge ${Math.abs(largestGap.gap) > 20 ? 'needs-attention' : 'balanced'}`;
    const suggestion = largestGap.gap > 20
        ? 'Consider adding Healthcare or Consumer ETFs to balance your exposure.'
        : 'Your sector mix is close to the benchmark. Recheck before adding concentrated positions.';
    insightText.innerHTML = `
        <strong>You are ${gapText}% ${direction} in ${largestGap.sector} compared to the market.</strong>
        <span>${suggestion}</span>
    `;

    compareList.innerHTML = sectors.map(item => {
        const gap = item.pct - item.benchmark;
        const gapClass = gap >= 0 ? 'over' : 'under';
        return `
            <div class="sector-compare-row">
                <div>
                    <span class="sector-color-dot" style="background:${getSectorColor(item.sector)}"></span>
                    <strong>${item.sector}</strong>
                </div>
                <span>Your ${item.pct.toFixed(1)}%</span>
                <span>S&amp;P ${item.benchmark.toFixed(1)}%</span>
                <em class="${gapClass} ${Math.abs(gap) > 20 ? 'major' : ''}">
                    ${Math.abs(gap) > 20 ? '<b>!</b>' : ''}${gap >= 0 ? '+' : ''}${gap.toFixed(1)}%
                </em>
            </div>
        `;
    }).join('');

    if (window.sectorChart) window.sectorChart.destroy();

    window.sectorChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: sectors.map(item => item.sector),
            datasets: [{
                data: sectors.map(item => item.pct),
                backgroundColor: sectors.map(item => getSectorColor(item.sector)),
                borderWidth: 0,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.label}: ${Number(ctx.raw || 0).toFixed(1)}%`
                    }
                }
            }
        }
    });
}

function updateInvestmentRiskPanel(holdings, totalValue) {
    const metricsEl = document.getElementById('investmentRiskMetrics');
    const tableEl = document.getElementById('investmentRiskTable');
    const labelEl = document.getElementById('investmentRiskLabel');
    const rows = Array.isArray(holdings) ? holdings : [];

    if (!metricsEl || !tableEl || !labelEl) return;

    if (!rows.length || totalValue <= 0) {
        labelEl.textContent = 'No data';
        metricsEl.innerHTML = `
            <div class="risk-metric-card">
                <span>Risk Analysis</span>
                <strong>--</strong>
                <p>Add investments to see beta, volatility, drawdown, and Sharpe ratio.</p>
            </div>
        `;
        tableEl.innerHTML = '';
        return;
    }

    const enriched = rows.map(holding => {
        const weight = totalValue > 0 ? parseFloat(holding.total_value || 0) / totalValue : 0;
        return {
            symbol: holding.symbol || 'Asset',
            weight,
            ...getHoldingRiskMetrics(holding.symbol)
        };
    });

    const portfolioBeta = enriched.reduce((sum, item) => sum + item.beta * item.weight, 0);
    const portfolioVolatility = enriched.reduce((sum, item) => sum + item.volatility * item.weight, 0);
    const portfolioDrawdown = enriched.reduce((sum, item) => sum + item.maxDrawdown * item.weight, 0);
    const portfolioSharpe = enriched.reduce((sum, item) => sum + item.sharpe * item.weight, 0);
    const riskLabel =
        portfolioBeta > 1.3 || portfolioVolatility > 30 ? 'High risk' :
        portfolioBeta > 1.05 || portfolioVolatility > 20 ? 'Moderate risk' :
        'Lower risk';

    labelEl.textContent = riskLabel;
    labelEl.className = `portfolio-score-badge ${
        riskLabel === 'High risk' ? 'high-risk' :
        riskLabel === 'Moderate risk' ? 'needs-attention' :
        'strong'
    }`;

    metricsEl.innerHTML = `
        <div class="risk-metric-card">
            <span>Beta</span>
            <strong>${portfolioBeta.toFixed(2)}</strong>
            <p>${portfolioBeta > 1 ? 'Moves more than the market.' : 'Moves less than the market.'} A beta near 1 means market-like movement.</p>
        </div>
        <div class="risk-metric-card">
            <span>Volatility</span>
            <strong>${portfolioVolatility.toFixed(1)}%</strong>
            <p>Higher volatility means bigger ups and downs along the way.</p>
        </div>
        <div class="risk-metric-card">
            <span>Max Drawdown</span>
            <strong>${portfolioDrawdown.toFixed(1)}%</strong>
            <p>This estimates the kind of recent peak-to-low drop the portfolio could experience.</p>
        </div>
        <div class="risk-metric-card">
            <span>Sharpe Ratio</span>
            <strong>${portfolioSharpe.toFixed(2)}</strong>
            <p>Above 1 is generally healthier: more return for each unit of risk.</p>
        </div>
    `;

    tableEl.innerHTML = `
        <div class="risk-row risk-row-head">
            <span>Asset</span>
            <span>Beta</span>
            <span>Volatility</span>
            <span>Max Drawdown</span>
            <span>Sharpe</span>
        </div>
        ${enriched.map(item => `
            <div class="risk-row">
                <strong>${escapeGoalText(item.symbol)}</strong>
                <span>${item.beta.toFixed(2)}</span>
                <span>${item.volatility.toFixed(1)}%</span>
                <span>${item.maxDrawdown.toFixed(1)}%</span>
                <span>${item.sharpe.toFixed(2)}</span>
            </div>
        `).join('')}
    `;
}

function getHoldingSparkline(symbol, dayChangePct = 0) {
    const trends = {
        AAPL: [22, 24, 23, 28, 31, 34, 38, 41],
        VOO: [20, 21, 22, 24, 25, 27, 28, 30],
        MSFT: [34, 33, 31, 30, 29, 31, 32, 33]
    };
    const key = String(symbol || '').toUpperCase();

    if (trends[key]) return trends[key];

    return parseFloat(dayChangePct || 0) >= 0
        ? [20, 21, 22, 24, 23, 25, 27, 29]
        : [30, 29, 28, 27, 26, 27, 25, 24];
}

function renderSparkline(points, tone = 'positive') {
    const values = Array.isArray(points) && points.length ? points : [20, 22, 21, 24, 26];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const coords = values.map((value, index) => {
        const x = (index / (values.length - 1)) * 72;
        const y = 28 - ((value - min) / range) * 24;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return `
        <svg class="holding-sparkline ${tone}" viewBox="0 0 72 32" aria-hidden="true">
            <polyline points="${coords}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></polyline>
        </svg>
    `;
}

function getInvestmentAnalysis(holdings, totalValue, totalReturn = 0) {
    const rows = Array.isArray(holdings) ? holdings : [];
    const allocations = rows
        .map(holding => {
            const value = parseFloat(holding.total_value || 0);
            return {
                symbol: holding.symbol || holding.name || 'Asset',
                name: holding.name || holding.symbol || 'Asset',
                pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
                gainPct: parseFloat(holding.gain_pct),
                dayChangePct: parseFloat(holding.day_change_pct)
            };
        })
        .sort((a, b) => b.pct - a.pct);

    const techSymbols = new Set(['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'GOOGL', 'AMZN']);
    const techExposure = allocations.reduce((sum, item) => {
        return techSymbols.has(String(item.symbol || '').toUpperCase()) ? sum + item.pct : sum;
    }, 0);
    const hasNegativeHolding = allocations.some(item => {
        const gain = Number.isFinite(item.gainPct) ? item.gainPct : item.dayChangePct;
        return Number.isFinite(gain) && gain < 0;
    });
    const largest = allocations[0] || null;

    let score = 100;
    const reasons = [];

    if (largest && largest.pct > 50) {
        score -= 20;
        reasons.push(`${largest.symbol} is more than half of the portfolio`);
    } else if (largest && largest.pct > 40) {
        score -= 12;
        reasons.push(`${largest.symbol} is the largest position`);
    } else if (largest && largest.pct > 30) {
        score -= 8;
        reasons.push(`${largest.symbol} has elevated weight`);
    }

    if (techExposure > 70) {
        score -= 15;
        reasons.push('technology exposure is very high');
    } else if (techExposure > 60) {
        score -= 10;
        reasons.push('technology exposure is high');
    }

    if (rows.length < 3) {
        score -= 8;
        reasons.push('there are fewer than three holdings');
    }

    if (hasNegativeHolding) {
        score -= 5;
        reasons.push('one holding needs review');
    }

    if (parseFloat(totalReturn || 0) < 0) {
        score -= 5;
        reasons.push('total profit is negative');
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    const label =
        score >= 85 ? 'Strong' :
        score >= 70 ? 'Balanced' :
        score >= 50 ? 'Needs attention' :
        'High risk';

    return {
        allocations,
        largest,
        largestPct: largest ? largest.pct : 0,
        techExposure,
        hasNegativeHolding,
        score,
        label,
        reasons
    };
}

function updateInvestmentDecisionLayer(holdings, totalValue, totalReturn) {
    const analysis = getInvestmentAnalysis(holdings, totalValue, totalReturn);
    const scoreEl = document.getElementById('portfolioHealthScore');
    const labelEl = document.getElementById('portfolioHealthLabel');
    const reasonEl = document.getElementById('portfolioHealthReason');
    const aiEl = document.getElementById('investmentAiInsight');
    const actionList = document.getElementById('investmentActionList');

    if (scoreEl) scoreEl.textContent = `${analysis.score} / 100`;
    if (labelEl) {
        labelEl.textContent = analysis.label;
        labelEl.className = `portfolio-score-badge ${analysis.label.toLowerCase().replace(/\s+/g, '-')}`;
    }

    const largestText = analysis.largest
        ? `${analysis.largest.symbol} at ${analysis.largestPct.toFixed(1)}%`
        : 'your largest holding';
    const techText = `${analysis.techExposure.toFixed(1)}%`;

    if (reasonEl) {
        reasonEl.textContent = analysis.reasons.length
            ? `Watch ${analysis.reasons.slice(0, 2).join(' and ')}.`
            : 'Your portfolio looks well spread for the current holdings.';
    }

    if (aiEl) {
        if (!analysis.allocations.length) {
            aiEl.textContent = 'Add investments to unlock portfolio guidance and risk context.';
        } else if (analysis.techExposure > 60) {
            aiEl.textContent = `Your portfolio is growing, but technology exposure is high at ${techText}. Diversifying across sectors may reduce risk.`;
        } else if (analysis.largestPct > 40) {
            aiEl.textContent = `${largestText} is driving much of the portfolio. Consider balancing before adding more to the same asset.`;
        } else {
            aiEl.textContent = `Your portfolio looks reasonably balanced. Keep reviewing allocation before making new contributions.`;
        }
    }

    if (actionList) {
        const actions = [];

        if (analysis.largest && analysis.largestPct > 40) {
            actions.push(`Reduce ${escapeGoalText(analysis.largest.symbol)} concentration before adding more.`);
        }

        if (analysis.techExposure > 60) {
            actions.push('Consider adding non-tech assets to improve diversification.');
        }

        if (analysis.hasNegativeHolding) {
            actions.push('Review holdings with negative performance before increasing them.');
        }

        if (analysis.allocations.length < 3) {
            actions.push('Add another holding to reduce single-asset dependency.');
        }

        if (!actions.length) {
            actions.push('Your portfolio looks balanced. Continue regular contributions.');
            actions.push('Review allocation monthly before adding new money.');
        }

        actionList.innerHTML = actions.slice(0, 4).map(action => `<li>${action}</li>`).join('');
    }
}

function setupInvestmentSimulator() {
    if (investmentSimulatorReady) return;

    ['investmentSimMonthly', 'investmentSimYears', 'investmentSimReturn'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', () => updateInvestmentSimulator(investmentSimulatorPortfolioValue));
        }
    });

    investmentSimulatorReady = true;
}

function updateInvestmentSimulator(currentValue) {
    investmentSimulatorPortfolioValue = parseFloat(currentValue || 0);

    const monthlyInput = document.getElementById('investmentSimMonthly');
    const yearsInput = document.getElementById('investmentSimYears');
    const returnInput = document.getElementById('investmentSimReturn');
    const resultEl = document.getElementById('investmentSimResult');

    if (!monthlyInput || !yearsInput || !returnInput || !resultEl) return;

    const monthlyContribution = Math.max(0, parseFloat(monthlyInput.value || 0));
    const years = Math.max(0, parseFloat(yearsInput.value || 0));
    const annualReturn = Math.max(0, parseFloat(returnInput.value || 0)) / 100;
    const months = Math.round(years * 12);
    const monthlyRate = annualReturn / 12;

    let futureValue = investmentSimulatorPortfolioValue;

    if (months > 0) {
        if (monthlyRate === 0) {
            futureValue = investmentSimulatorPortfolioValue + (monthlyContribution * months);
        } else {
            futureValue =
                investmentSimulatorPortfolioValue * Math.pow(1 + monthlyRate, months) +
                monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
        }
    }

    const totalContributed = monthlyContribution * months;
    const estimatedGain = Math.max(futureValue - investmentSimulatorPortfolioValue - totalContributed, 0);

    resultEl.textContent = `If you invest ${fmt(monthlyContribution)}/month for ${years || 0} years, your portfolio could reach about ${fmt(futureValue)}. Estimated growth: ${fmt(estimatedGain)}.`;
}

function getGoalLinkedHoldings(goal, holdings) {
    const rows = Array.isArray(holdings) ? holdings : [];
    const goalText = `${goal.name || ''} ${goal.category || ''}`.toLowerCase();
    const category = String(goal.category || '').toLowerCase();

    const travelSymbols = ['AAPL', 'VOO', 'MSFT'];
    const emergencySymbols = ['VOO'];
    const homeSymbols = ['VOO', 'MSFT'];

    let symbols = [];

    if (goalText.includes('travel') || goalText.includes('trip') || goalText.includes('thailand') || category.includes('travel')) {
        symbols = travelSymbols;
    } else if (goalText.includes('emergency')) {
        symbols = emergencySymbols;
    } else if (goalText.includes('home') || goalText.includes('house')) {
        symbols = homeSymbols;
    } else {
        symbols = rows.slice(0, 2).map(holding => String(holding.symbol || '').toUpperCase());
    }

    return rows.filter(holding => symbols.includes(String(holding.symbol || '').toUpperCase()));
}

function estimateGoalInvestmentTiming(goal, linkedValue, linkedHoldings) {
    const target = parseFloat(goal.target_amount || 0);
    const saved = parseFloat(goal.effective_saved_amount ?? goal.saved_amount ?? 0);
    const remaining = Math.max(target - saved - linkedValue, 0);
    const deadline = goal.deadline ? new Date(goal.deadline) : null;
    const rows = Array.isArray(linkedHoldings) ? linkedHoldings : [];

    if (!deadline || Number.isNaN(deadline.getTime())) {
        return 'Add a target date to estimate timing.';
    }

    if (remaining <= 0) {
        return 'Your linked investments could cover this goal today.';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);

    const monthsToDeadline = Math.max(1, Math.ceil((deadline - today) / (1000 * 60 * 60 * 24 * 30)));
    const weightedGrowth = rows.reduce((sum, holding) => {
        const value = parseFloat(holding.total_value || 0);
        const gainPct = parseFloat(holding.gain_pct || 0) / 100;
        return sum + (value * Math.max(gainPct, 0));
    }, 0);
    const growthRate = linkedValue > 0 ? Math.max(weightedGrowth / linkedValue, 0.04) : 0.06;
    const monthlyGrowth = Math.pow(1 + growthRate, 1 / 12) - 1;

    if (linkedValue <= 0 || monthlyGrowth <= 0) {
        return `Add linked investments to see if you can reach this goal before ${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`;
    }

    const projectedAtDeadline = linkedValue * Math.pow(1 + monthlyGrowth, monthsToDeadline);
    const gapAtDeadline = remaining - (projectedAtDeadline - linkedValue);

    if (gapAtDeadline <= 0) {
        const monthsNeeded = Math.max(1, Math.ceil(Math.log((linkedValue + remaining) / linkedValue) / Math.log(1 + monthlyGrowth)));
        const monthsEarly = Math.max(monthsToDeadline - monthsNeeded, 0);
        return monthsEarly >= 1
            ? `At current growth, you could hit this goal about ${monthsEarly} ${monthsEarly === 1 ? 'month' : 'months'} early.`
            : 'At current growth, you are tracking close to the target date.';
    }

    return `At current growth, you may need about ${fmt(gapAtDeadline)} more by the target date.`;
}

async function loadInvestmentGoalsCoverage(portfolioValue, holdings = allInvestmentHoldings) {
    const container = document.getElementById('investmentGoalsCoverage');
    if (!container) return;

    try {
        let goals = Array.isArray(allGoals) && allGoals.length ? allGoals : [];

        if (!goals.length) {
            const response = await fetch(API + '/goals');
            await throwIfNotOk(response, 'Goals unavailable');
            goals = await response.json();
            if (Array.isArray(goals)) allGoals = goals;
        }

        if (!Array.isArray(goals) || !goals.length) {
            container.innerHTML = `<p class="investment-muted">Create goals to see how investments support your plans.</p>`;
            return;
        }

        container.innerHTML = goals.slice(0, 3).map(goal => {
            const target = parseFloat(goal.target_amount || 0);
            const linkedHoldings = getGoalLinkedHoldings(goal, holdings);
            const linkedValue = linkedHoldings.reduce((sum, holding) => sum + parseFloat(holding.total_value || 0), 0);
            const fallbackValue = linkedValue || portfolioValue;
            const coverage = target > 0 ? Math.min((fallbackValue / target) * 100, 999) : 0;
            const coverageText = coverage >= 100 ? '100%+' : `${coverage.toFixed(0)}%`;
            const name = escapeGoalText(goal.name || 'Goal');
            const symbols = linkedHoldings.map(holding => escapeGoalText(holding.symbol)).join(', ') || 'portfolio';
            const timing = estimateGoalInvestmentTiming(goal, linkedValue, linkedHoldings);
            const fundingLine = linkedHoldings.length
                ? `These ${linkedHoldings.length} ${linkedHoldings.length === 1 ? 'holding is' : 'holdings are'} funding this goal: ${symbols}.`
                : 'Your full portfolio can be compared against this goal.';

            return `
                <div class="investment-goal-row upgraded">
                    <div class="investment-goal-main">
                        <span>${name}</span>
                        <strong>${coverageText} covered</strong>
                    </div>
                    <div class="investment-goal-progress">
                        <span style="width:${Math.min(coverage, 100)}%"></span>
                    </div>
                    <p>${fundingLine}</p>
                    <em>${escapeGoalText(timing)}</em>
                </div>
            `;
        }).join('');
    } catch (error) {
        container.innerHTML = `<p class="investment-muted">Connect goals to see how investments support your plans.</p>`;
    }
}

function updateHoldingsInsightStrip(holdings) {
    const strip = document.getElementById('holdingsInsightStrip');
    if (!strip) return;

    const rows = Array.isArray(holdings)
        ? holdings
            .map(holding => ({
                symbol: holding.symbol || holding.name || 'Asset',
                score: Number.isFinite(parseFloat(holding.gain_pct))
                    ? parseFloat(holding.gain_pct)
                    : parseFloat(holding.day_change_pct)
            }))
            .filter(holding => Number.isFinite(holding.score))
        : [];

    if (!rows.length) {
        strip.style.display = 'none';
        strip.innerHTML = '';
        return;
    }

    const best = rows.reduce((top, item) => item.score > top.score ? item : top, rows[0]);
    const worst = rows.reduce((low, item) => item.score < low.score ? item : low, rows[0]);

    strip.style.display = 'flex';
    strip.innerHTML = `
        <div class="holding-summary-chip best">
            <span>Best</span>
            <strong>${escapeGoalText(best.symbol)} ${pctText(best.score)}</strong>
        </div>
        <div class="holding-summary-chip worst">
            <span>Worst</span>
            <strong>${escapeGoalText(worst.symbol)} ${pctText(worst.score)}</strong>
        </div>
    `;
}

function updateAllocationCard(holdings) {
    const allocationList = document.getElementById('allocationList');
    const allocationInsight = document.getElementById('allocationInsight');

    if (!allocationList || !allocationInsight) return;

    const rows = Array.isArray(holdings) ? holdings : [];
    const totalValue = rows.reduce((sum, holding) => {
        return sum + parseFloat(holding.total_value || 0);
    }, 0);

    if (!rows.length || totalValue <= 0) {
        allocationList.innerHTML = `
            <div class="allocation-empty">No allocation data yet.</div>
        `;
        allocationInsight.className = 'allocation-insight neutral';
        allocationInsight.innerHTML = `
            <div class="allocation-insight-icon">i</div>
            <div>
                <p class="allocation-insight-label">Allocation insight</p>
                <p class="allocation-insight-text">Add investments to see allocation insights.</p>
            </div>
        `;
        return;
    }

    const allocations = rows
        .map(holding => {
            const value = parseFloat(holding.total_value || 0);
            return {
                symbol: holding.symbol || holding.name || 'Asset',
                pct: totalValue > 0 ? (value / totalValue) * 100 : 0
            };
        })
        .sort((a, b) => b.pct - a.pct);

    allocationList.innerHTML = allocations.map(item => {
        const pct = Number.isFinite(item.pct) ? item.pct : 0;
        const pctText = pct % 1 === 0 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;

        return `
            <div class="alloc-item">
                <div>
                    <p class="alloc-name">${escapeGoalText(item.symbol)}</p>
                    <div class="progress-bar" style="margin-top:6px">
                        <div class="progress-fill ok" style="width:${Math.min(pct, 100).toFixed(1)}%"></div>
                    </div>
                </div>
                <span class="alloc-pct">${pctText}</span>
            </div>
        `;
    }).join('');

    const top = allocations[0];
    const topPct = Number.isFinite(top.pct) ? top.pct : 0;
    const topPctText = topPct % 1 === 0 ? `${topPct.toFixed(0)}%` : `${topPct.toFixed(1)}%`;
    const isConcentrated = topPct > 40;
    const isBalanced = topPct >= 25;
    const techSymbols = new Set(['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'GOOGL', 'AMZN']);
    const techExposure = allocations.reduce((sum, item) => {
        return techSymbols.has(String(item.symbol || '').toUpperCase()) ? sum + item.pct : sum;
    }, 0);
    const techExposureText = techExposure % 1 === 0 ? `${techExposure.toFixed(0)}%` : `${techExposure.toFixed(1)}%`;
    const techInsight = techExposure > 60
        ? `<p class="allocation-insight-text">You are heavily exposed to technology stocks at ${techExposureText}. Consider diversifying across sectors.</p>`
        : '';

    allocationInsight.className = `allocation-insight ${isConcentrated ? 'warning' : 'neutral'}`;
    allocationInsight.innerHTML = `
        <div class="allocation-insight-icon">${isConcentrated ? '!' : 'i'}</div>
        <div>
            <p class="allocation-insight-label">Allocation insight</p>
            <p class="allocation-insight-text">${
                isConcentrated
                    ? `${escapeGoalText(top.symbol)} makes up ${topPctText} of your portfolio. This may increase concentration risk.`
                    : isBalanced
                        ? `Your largest holding is ${escapeGoalText(top.symbol)} at ${topPctText}. Allocation looks reasonably balanced.`
                        : `Your holdings are broadly spread. The largest position is ${escapeGoalText(top.symbol)} at ${topPctText}.`
            }</p>
            ${techInsight}
        </div>
    `;
}

// ── CHARTS ──
window.incomeChart   = null;
window.spendingChart = null;
window.portfolioChart = null;
window.sectorChart = null;

function buildIncomeChartMonthlySeries(months = 12) {
    const src = Array.isArray(allTransactions) ? allTransactions : [];
    const buckets = new Map();
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        buckets.set(key, { income: 0, expense: 0, label: d });
    }
    for (const tx of src) {
        if (!tx || !tx.date) continue;
        const d = new Date(tx.date);
        if (Number.isNaN(d.getTime())) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const bucket = buckets.get(key);
        if (!bucket) continue;
        const amt = parseFloat(tx.amount || 0);
        if (!Number.isFinite(amt)) continue;
        if (amt > 0) bucket.income += amt;
        else bucket.expense += Math.abs(amt);
    }
    const locale = CURRENT_LANG === 'fr' ? 'fr-FR' : CURRENT_LANG === 'es' ? 'es-ES' : 'en-US';
    const labels = [];
    const incomeData = [];
    const expenseData = [];
    for (const bucket of buckets.values()) {
        labels.push(bucket.label.toLocaleDateString(locale, { month: 'short', year: '2-digit' }));
        incomeData.push(Math.round(bucket.income * 100) / 100);
        expenseData.push(Math.round(bucket.expense * 100) / 100);
    }
    return { labels, incomeData, expenseData };
}

let incomeChartMonths = 12;

function buildIncomeChart() {
    const canvas = document.getElementById('incomeExpenseChart');
    if (!canvas) return;
    const dark = html.getAttribute('data-theme') === 'dark';
    const grid = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const tick = dark ? '#6b7280' : '#9ca3af';
    const tbg  = dark ? '#1f2937' : '#ffffff';
    const tfg  = dark ? '#f9fafb' : '#111827';

    let labels, incomeData, expenseData;
    if (SHOW_DEMO_DATA) {
        labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'];
        incomeData = [6200,6800,7100,6900,7400,8200,7800,8500];
        expenseData = [2800,3100,2900,3200,2700,3100,2900,3400];
    } else {
        const series = buildIncomeChartMonthlySeries(incomeChartMonths);
        labels = series.labels;
        incomeData = series.incomeData;
        expenseData = series.expenseData;
    }
    if (window.incomeChart) window.incomeChart.destroy();
    window.incomeChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label:'Income',   data:incomeData, borderColor:'#10b981', backgroundColor:'rgba(16,185,129,0.08)', borderWidth:2.5, pointRadius:0, pointHoverRadius:5, fill:true, tension:0.4 },
                { label:'Expenses', data:expenseData, borderColor:'#8b5cf6', backgroundColor:'rgba(139,92,246,0.06)',  borderWidth:2.5, pointRadius:0, pointHoverRadius:5, fill:true, tension:0.4 }
            ]
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            interaction:{mode:'index',intersect:false},
            plugins:{legend:{display:false},tooltip:{backgroundColor:tbg,titleColor:tfg,bodyColor:tfg,borderColor:'rgba(0,0,0,0.1)',borderWidth:1,padding:12,cornerRadius:8,callbacks:{label:c=>` ${c.dataset.label}: ${fmt(c.parsed.y)}`}}},
            scales:{x:{grid:{color:grid},ticks:{color:tick,font:{size:11}},border:{display:false}},y:{grid:{color:grid},ticks:{color:tick,font:{size:11},callback:v=>formatCurrency(v, { compact: true })},border:{display:false}}}
        }
    });
}

const SPENDING_DONUT_PALETTE = [
    '#10b981', // green
    '#8b5cf6', // violet
    '#f59e0b', // amber
    '#ec4899', // pink
    '#3b82f6', // blue
    '#14b8a6', // teal
    '#ef4444', // red
    '#06b6d4', // cyan
    '#a78bfa', // light violet
    '#9ca3af', // grey (Other)
];

function buildSpendingCurrentMonthBreakdown() {
    const src = Array.isArray(allTransactions) ? allTransactions : [];
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const totals = new Map();
    let monthTotal = 0;
    for (const tx of src) {
        if (!tx || !tx.date) continue;
        const amt = parseFloat(tx.amount || 0);
        if (!Number.isFinite(amt) || amt >= 0) continue;
        const d = new Date(tx.date);
        if (Number.isNaN(d.getTime())) continue;
        if (d.getFullYear() !== y || d.getMonth() !== m) continue;
        const abs = Math.abs(amt);
        const cat = String(tx.category || 'Other').trim() || 'Other';
        totals.set(cat, (totals.get(cat) || 0) + abs);
        monthTotal += abs;
    }
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5);
    if (rest.length) {
        const restTotal = rest.reduce((sum, [, v]) => sum + v, 0);
        top.push(['Other', (top.find(p => p[0] === 'Other')?.[1] || 0) + restTotal]);
    }
    return { breakdown: top, monthTotal };
}

function renderSpendingDonutLegend(breakdown, colors) {
    const wrap = document.querySelector('#page-dashboard .donut-legend');
    if (!wrap) return;
    if (!breakdown || !breakdown.length) {
        wrap.innerHTML = '';
        return;
    }
    wrap.innerHTML = breakdown.map(([cat, value], i) => {
        const label = typeof translateCategory === 'function' ? translateCategory(cat) : cat;
        return `
            <div class="legend-item">
                <span class="legend-dot" style="background:${colors[i % colors.length]}"></span>
                <span>${escapeHTML(label)}</span>
                <strong>${escapeHTML(formatCurrency(value, { compact: false }))}</strong>
            </div>
        `;
    }).join('');
}

function buildSpendingChart() {
    const canvas = document.getElementById('spendingChart');
    if (!canvas) return;
    if (window.spendingChart) window.spendingChart.destroy();

    let labels, values, colors, total;
    if (SHOW_DEMO_DATA) {
        labels = ['Housing','Groceries','Dining','Transport','Entertainment','Other'];
        values = [1800,420,280,150,95,197];
        colors = SPENDING_DONUT_PALETTE.slice(0, 6);
        total = values.reduce((s, v) => s + v, 0);
        renderSpendingDonutLegend(labels.map((l, i) => [l, values[i]]), colors);
    } else {
        const { breakdown, monthTotal } = buildSpendingCurrentMonthBreakdown();
        if (breakdown.length) {
            labels = breakdown.map(([cat]) => typeof translateCategory === 'function' ? translateCategory(cat) : cat);
            values = breakdown.map(([, v]) => Math.round(v * 100) / 100);
            colors = breakdown.map((_, i) => SPENDING_DONUT_PALETTE[i % SPENDING_DONUT_PALETTE.length]);
            total = monthTotal;
            renderSpendingDonutLegend(breakdown, colors);
        } else {
            labels = [t('dashboard.no_spending', 'No spending yet')];
            values = [1];
            colors = ['rgba(148, 163, 184, 0.18)'];
            total = 0;
            renderSpendingDonutLegend([], []);
        }
    }

    const amountEl = document.querySelector('#page-dashboard .donut-amount');
    if (amountEl) amountEl.textContent = formatCurrency(total, { compact: false });

    window.spendingChart = new Chart(canvas.getContext('2d'), {
        type:'doughnut',
        data:{labels,datasets:[{data:values,backgroundColor:colors,borderWidth:0,hoverOffset:6}]},
        options:{
            responsive:true,
            maintainAspectRatio:true,
            cutout:'72%',
            plugins:{
                legend:{display:false},
                tooltip:{
                    callbacks:{
                        label: (c) => ` ${c.label}: ${formatCurrency(c.parsed, { compact: false })}`
                    }
                }
            }
        }
    });
}

function buildPortfolioChart() {
    const canvas = document.getElementById('portfolioChart');
    if (!canvas) return;
    const summaryEl = document.getElementById('portfolioChartSummary');

    if (!SHOW_DEMO_DATA) {
        if (summaryEl) {
            summaryEl.textContent = allInvestmentHoldings.length
                ? 'Historical performance will appear once market history is connected.'
                : 'Add investments to compare portfolio performance.';
            summaryEl.classList.remove('negative');
        }

        if (window.portfolioChart) window.portfolioChart.destroy();
        window.portfolioChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Portfolio',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16,185,129,0.05)',
                        borderWidth: 2.4,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: { grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { color: '#9ca3af', font: { size: 11 } }, border: { display: false } },
                    y: { grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { color: '#9ca3af', font: { size: 11 } }, border: { display: false } }
                }
            }
        });
        return;
    }

    const activeRange = document.querySelector('.investment-chart-card .chart-tab.active')?.textContent.trim() || 'YTD';
    const chartRanges = {
        '1M': {
            labels: ['Week 1','Week 2','Week 3','Week 4'],
            portfolio: [14120,14280,14370,14499],
            sp500: [14120,14190,14260,14310],
            nasdaq: [14120,14220,14320,14420],
            whatIf: [15120,15310,15440,15610],
            buys: [{ x: 'Week 2', y: 14280, label: 'Added AAPL' }],
            events: [{ x: 'Week 3', y: 14540, label: 'Earnings week' }]
        },
        '3M': {
            labels: ['Feb','Mar','Apr'],
            portfolio: [13250,13920,14499],
            sp500: [13250,13610,13980],
            nasdaq: [13250,13780,14340],
            whatIf: [14250,15080,15840],
            buys: [{ x: 'Feb', y: 13250, label: 'Bought VOO' }, { x: 'Apr', y: 14499, label: 'Bought MSFT' }],
            events: [{ x: 'Mar', y: 14150, label: 'Fed decision' }]
        },
        'YTD': {
            labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'],
            portfolio: [8500,8800,9100,8900,9300,9600,9800,10200],
            sp500: [8500,8685,8780,8660,8990,9220,9410,9660],
            nasdaq: [8500,8720,9050,8825,9360,9700,10030,10620],
            whatIf: [9500,9825,10210,9990,10520,10910,11280,11820],
            buys: [{ x: 'Jan', y: 8500, label: 'Bought AAPL' }, { x: 'Feb', y: 8800, label: 'Bought VOO' }, { x: 'Apr', y: 8900, label: 'Bought MSFT' }],
            events: [{ x: 'Mar', y: 9300, label: 'Fed decision' }, { x: 'May', y: 9550, label: 'Big tech earnings' }, { x: 'Jul', y: 10150, label: 'Market rally' }]
        },
        '1Y': {
            labels: ['Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'],
            portfolio: [7600,7820,8050,8290,8500,8800,9100,8900,9300,9600,9800,10200],
            sp500: [7600,7740,7920,8120,8320,8500,8660,8540,8860,9080,9280,9520],
            nasdaq: [7600,7810,8060,8310,8580,8840,9180,8960,9520,9840,10180,10780],
            whatIf: [8600,8900,9220,9530,9810,10180,10580,10320,10890,11320,11740,12280],
            buys: [{ x: 'Jan', y: 8500, label: 'Bought AAPL' }, { x: 'Feb', y: 8800, label: 'Bought VOO' }, { x: 'Apr', y: 8900, label: 'Bought MSFT' }],
            events: [{ x: 'Dec', y: 8500, label: 'Year-end rally' }, { x: 'Mar', y: 9300, label: 'Fed decision' }, { x: 'May', y: 9550, label: 'Big tech earnings' }]
        }
    };
    const selected = chartRanges[activeRange] || chartRanges.YTD;
    const labels = selected.labels;
    const portfolio = selected.portfolio;
    const sp500 = selected.sp500;
    const nasdaq = selected.nasdaq;
    const whatIf = selected.whatIf;
    const showWhatIf = document.getElementById('portfolioWhatIfToggle')?.checked;
    const buyMarkers = selected.buys;
    const eventMarkers = selected.events;
    const firstPortfolio = portfolio[0] || 0;
    const lastPortfolio = portfolio[portfolio.length - 1] || 0;
    const firstSp500 = sp500[0] || 0;
    const lastSp500 = sp500[sp500.length - 1] || 0;
    const portfolioReturn = firstPortfolio > 0 ? ((lastPortfolio - firstPortfolio) / firstPortfolio) * 100 : 0;
    const sp500Return = firstSp500 > 0 ? ((lastSp500 - firstSp500) / firstSp500) * 100 : 0;
    const outperformance = portfolioReturn - sp500Return;
    if (summaryEl) {
        const rangeLabel = activeRange === 'YTD' ? 'YTD' : `over ${activeRange}`;
        const direction = outperformance >= 0 ? 'outperforming' : 'trailing';
        summaryEl.textContent = `Your portfolio is ${direction} S&P 500 by ${pctText(Math.abs(outperformance))} ${rangeLabel}.`;
        summaryEl.classList.toggle('negative', outperformance < 0);
    }

    if (window.portfolioChart) window.portfolioChart.destroy();

    window.portfolioChart = new Chart(canvas.getContext('2d'), {
        type:'line',
        data:{
            labels,
            datasets:[
                {label:'Portfolio',data:portfolio,borderColor:'#10b981',backgroundColor:'rgba(16,185,129,0.05)',borderWidth:2.4,pointRadius:0,pointHoverRadius:4,fill:true,tension:0.4},
                {label:'S&P 500',data:sp500,borderColor:'#3b82f6',backgroundColor:'transparent',borderWidth:1.7,pointRadius:0,borderDash:[5,4],tension:0.4},
                {label:'NASDAQ',data:nasdaq,borderColor:'#7c3aed',backgroundColor:'transparent',borderWidth:2,pointRadius:0,borderDash:[7,4],tension:0.4},
                ...(showWhatIf ? [{label:'What-if: +$1,000 AAPL',data:whatIf,borderColor:'#f97316',backgroundColor:'transparent',borderWidth:1.5,pointRadius:0,borderDash:[7,6],tension:0.4}] : []),
                {label:'Buy markers',data:buyMarkers,borderColor:'#10b981',backgroundColor:'#ffffff',showLine:false,pointRadius:3.5,pointHoverRadius:5.5,pointBorderWidth:2,pointStyle:'circle'},
                {label:'Market events',data:eventMarkers,borderColor:'#f97316',backgroundColor:'#fff7ed',showLine:false,pointRadius:3.5,pointHoverRadius:5,pointBorderWidth:2,pointStyle:'rectRot'}
            ]
        },
        options:{
            responsive:true,
            maintainAspectRatio:false,
            interaction:{mode:'nearest',intersect:false},
            plugins:{
                legend:{display:false},
                tooltip:{
                    callbacks:{
                        title:items=>{
                            const item = items && items[0];
                            return item ? `Date: ${item.label}` : '';
                        },
                        label:ctx=>{
                            const raw = ctx.raw || {};
                            const value = typeof raw.y === 'number' ? raw.y : ctx.parsed.y;

                            if (ctx.dataset.label === 'Buy markers' || ctx.dataset.label === 'Market events') {
                                return [
                                    `Portfolio value: ${fmt(value)}`,
                                    `Event: ${raw.label || ctx.dataset.label}`
                                ];
                            }
                            return `${ctx.dataset.label}: ${fmt(value)}`;
                        }
                    }
                }
            },
            scales:{
                x:{grid:{color:'rgba(0,0,0,0.03)'},ticks:{color:'#9ca3af',font:{size:11}},border:{display:false}},
                y:{
                    min: Math.floor(Math.min(...portfolio, ...sp500, ...nasdaq, ...(showWhatIf ? whatIf : [])) / 500) * 500,
                    max: Math.ceil(Math.max(...portfolio, ...sp500, ...nasdaq, ...(showWhatIf ? whatIf : [])) / 500) * 500,
                    grid:{color:'rgba(0,0,0,0.03)'},
                    ticks:{
                        color:'#9ca3af',
                        font:{size:11},
                        stepSize:500,
                        callback:v=>formatCurrency(v, { compact: true })
                    },
                    border:{display:false}
                }
            }
        }
    });
}

const portfolioWhatIfToggle = document.getElementById('portfolioWhatIfToggle');
if (portfolioWhatIfToggle) {
    portfolioWhatIfToggle.addEventListener('change', buildPortfolioChart);
}

// ── DEMO DATA (fallback if backend is off) ──
const DEMO_TRANSACTIONS = [
    { id:1,  name:'Salary Deposit',       category:'Income',        account:'Main Checking',  date:'2026-04-21', amount:+4210.00 },
    { id:2,  name:'Whole Foods Market',   category:'Groceries',     account:'Rewards Card',   date:'2026-04-21', amount:-156.42  },
    { id:3,  name:'Netflix Subscription', category:'Entertainment', account:'Rewards Card',   date:'2026-04-20', amount:-15.99   },
    { id:4,  name:'Uber Ride',            category:'Transport',     account:'Main Checking',  date:'2026-04-20', amount:-24.50   },
    { id:5,  name:'Electric Bill',        category:'Utilities',     account:'Main Checking',  date:'2026-04-19', amount:-145.00  },
    { id:6,  name:'Rent Payment',         category:'Housing',       account:'Main Checking',  date:'2026-04-18', amount:-1800.00 },
    { id:7,  name:'Starbucks',            category:'Dining',        account:'Rewards Card',   date:'2026-04-18', amount:-7.50    },
    { id:8,  name:'Gym Membership',       category:'Health',        account:'Main Checking',  date:'2026-04-17', amount:-49.99   },
    { id:9,  name:'Amazon Purchase',      category:'Shopping',      account:'Rewards Card',   date:'2026-04-17', amount:-89.99   },
    { id:10, name:'Freelance Payment',    category:'Income',        account:'Main Checking',  date:'2026-04-16', amount:+850.00  },
    { id:11, name:"McDonald's",           category:'Dining',        account:'Rewards Card',   date:'2026-04-16', amount:-12.30   },
    { id:12, name:'Spotify',              category:'Entertainment', account:'Rewards Card',   date:'2026-04-15', amount:-9.99    },
];

function updateRecurringDueThisWeek() {
    const rows = document.querySelectorAll('#page-recurring tbody tr');

    let totalDue = 0;
    let countDue = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    rows.forEach(row => {
        if (!SHOW_DEMO_DATA && row.classList.contains('demo-only')) return;

        const amountCell = row.querySelector('td:nth-child(4)');
        const dateCell = row.querySelector('td:nth-child(3)');

        if (!amountCell || !dateCell) return;

        const amountText = amountCell.textContent.replace(/[^0-9.-]/g, '');
        const rawAmount = parseFloat(amountText) || 0;
        const amount = Math.abs(rawAmount);

        const dateText = dateCell.querySelector(".recurring-date-value")
            ? dateCell.querySelector(".recurring-date-value").textContent.trim()
            : dateCell.textContent.replace('📅', '').trim();

        const dueDate = new Date(dateText);

        if (
            !Number.isNaN(dueDate.getTime()) &&
            dueDate >= today &&
            dueDate <= sevenDaysFromNow &&
            rawAmount < 0
        ) {
            totalDue += amount;
            countDue += 1;
        }
    });

    const dueAmountEl = document.getElementById('recurring-due-week');
    const dueCountEl = document.getElementById('recurring-due-week-count');

    if (dueAmountEl) dueAmountEl.textContent = fmt(totalDue);
    if (dueCountEl) {
        dueCountEl.textContent =
            countDue === 0 ? t('recurring.payments_due.zero', '0 payments due') :
            countDue === 1 ? t('recurring.payments_due.one', '1 payment due') :
            t('recurring.payments_due.many', '{n} payments due').replace('{n}', countDue);
    }
}

function recurringDueLabel(dateStr) {
    const today = new Date();
    today.setHours(0,0,0,0);

    const due = new Date(dateStr);
    due.setHours(0,0,0,0);

    const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));

    if (diff < 0) return `<span class="due-badge overdue">${escapeHTML(t('recurring.due.overdue', 'Overdue'))}</span>`;
    if (diff === 0) return `<span class="due-badge today">${escapeHTML(t('recurring.due.today', 'Today'))}</span>`;
    if (diff === 1) return `<span class="due-badge soon">${escapeHTML(t('recurring.due.tomorrow', 'Tomorrow'))}</span>`;

    const label = diff === 1
        ? t('recurring.due.days_left.one', '1 day left')
        : t('recurring.due.days_left.many', '{n} days left').replace('{n}', diff);
    const className = diff <= 7 ? 'soon' : 'normal';
    return `<span class="due-badge ${className}">${escapeHTML(label)}</span>`;
}

function isRecurringDueSoon(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(dateStr);
    due.setHours(0, 0, 0, 0);

    const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));

    return diff <= 7;
}

function formatDate(dateStr) {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return String(dateStr);

    const locale = CURRENT_LANG === 'fr' ? 'fr-FR'
        : CURRENT_LANG === 'es' ? 'es-ES'
        : 'en-US';

    return date.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatFrequencyLabel(frequency) {
    const key = String(frequency || '').toLowerCase();
    const fallbacks = {
        weekly: 'Weekly',
        biweekly: 'Biweekly',
        monthly: 'Monthly',
        quarterly: 'Quarterly',
        yearly: 'Yearly'
    };
    if (fallbacks[key]) return t(`recurring.freq.${key}`, fallbacks[key]);
    return String(frequency || t('recurring.freq.monthly', 'Monthly'));
}

function dateInputValue(dateValue) {
    if (!dateValue) return '';

    const asString = String(dateValue);
    const directMatch = asString.match(/\d{4}-\d{2}-\d{2}/);
    if (directMatch) return directMatch[0];

    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return '';

    return parsed.toISOString().split('T')[0];
}

function enhanceRecurringDateCells() {
    const rows = document.querySelectorAll('#page-recurring tbody tr');

    rows.forEach(row => {
        const dateCell = row.querySelector('td:nth-child(3)');
        if (!dateCell) return;

        const dateText = dateCell.textContent.replace('📅', '').trim();
        if (!dateText) return;

        dateCell.innerHTML = `
            <div class="recurring-date-value">${dateText}</div>
            ${recurringDueLabel(dateText)}
        `;
    });
}

function updateRecurringStats(items) {
    const recurringPage = document.getElementById('page-recurring');
    if (!recurringPage) return;

    const statValues = recurringPage.querySelectorAll('.stats-row .stat-value');
    if (statValues.length < 3) return;

    const recurringItems = Array.isArray(items) ? items : [];

    const monthlyIncome = recurringItems.reduce((sum, item) => {
        const amount = parseFloat(item.amount || 0);
        return amount > 0 ? sum + amount : sum;
    }, 0);

    const monthlyExpenses = recurringItems.reduce((sum, item) => {
        const amount = parseFloat(item.amount || 0);
        return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);

    const monthlyNet = monthlyIncome - monthlyExpenses;

    statValues[0].textContent = fmt(monthlyIncome);
    statValues[1].textContent = fmt(monthlyExpenses);
    statValues[2].textContent = signedMoney(monthlyNet);

    statValues[0].style.color = 'var(--green)';
    statValues[1].style.color = 'var(--red)';
    statValues[2].style.color = monthlyNet >= 0 ? 'var(--green)' : 'var(--red)';
}

function getRecurringStatusText(item, isIncome) {
    if (item.completed_this_cycle) {
        return isIncome
            ? t("recurring.status.received", "Received")
            : t("recurring.status.paid", "Paid");
    }

    return t("recurring.status.pending", "Pending");
}

function getRecurringStatusClass(item) {
    if (item.completed_this_cycle) {
        return "done";
    }

    return "pending";
}

function renderRecurringPayments(items) {
    const tbody = document.querySelector("#page-recurring tbody");
    if (!tbody) return;

    if (!items || items.length === 0) {
        const dueAmountEl = document.getElementById('recurring-due-week');
        const dueCountEl = document.getElementById('recurring-due-week-count');

        if (dueAmountEl) dueAmountEl.textContent = fmt(0);
        if (dueCountEl) dueCountEl.textContent = t('recurring.payments_due.zero', '0 payments due');

        const emptyTitle = escapeHTML(t('recurring.empty.title', 'No recurring payments yet'));
        const emptyText = escapeHTML(t('recurring.empty.text', 'Add rent, salary, subscriptions, or any payment that repeats.'));

        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="premium-empty-state">
                        <div class="premium-empty-state-icon">🔁</div>
                        <h3 class="premium-empty-state-title">${emptyTitle}</h3>
                        <p class="premium-empty-state-text">${emptyText}</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const amount = parseFloat(item.amount || 0);
        const isIncome = amount > 0;
        const dueSoon = isRecurringDueSoon(item.next_date);
        const categoryName = item.category || (isIncome ? 'Income' : 'Other');
        const categoryIcon = getCategoryIcon(categoryName) || (isIncome ? '💰' : '💳');
        const safeId = escapeHTML(item.id ?? '');
        const safeName = escapeHTML(item.name || 'Recurring payment');
        const safeCategory = escapeHTML(categoryName);
        const safeCategoryIcon = escapeHTML(categoryIcon);
        const safeFrequency = escapeHTML(formatFrequencyLabel(item.frequency));
        const safeDate = escapeHTML(formatDate(item.next_date));
        const safeStatusClass = escapeHTML(getRecurringStatusClass(item));
        const safeStatusText = escapeHTML(getRecurringStatusText(item, isIncome));

        return `
            <tr>
                <td>
                    <div class="tx-cell-name">
                        <div class="tx-cell-icon ${isIncome ? 'green-icon' : 'gray-icon'}" title="${safeCategory}">
                            ${safeCategoryIcon}
                        </div>
                        <p class="tx-cell-title">${safeName}</p>
                    </div>
                </td>

                <td><span class="freq-badge">${safeFrequency}</span></td>

                <td class="tx-date-cell">
                    <div class="recurring-date-value">${safeDate}</div>
                    ${recurringDueLabel(item.next_date)}
                </td>

                <td class="tx-amount-cell ${isIncome ? 'positive' : 'negative'}">
                    ${isIncome ? '+' : ''}${fmt(amount)}
                </td>

                <td>
                    <span class="recurring-status-badge ${safeStatusClass}">
                        ${safeStatusText}
                    </span>
                </td>

                <td>
                    <button
                        class="recurring-action-btn ${isIncome ? 'received' : 'paid'}"
                        data-id="${safeId}"
                        ${dueSoon ? '' : 'disabled'}
                    >
                        ${
                            dueSoon
                                ? (isIncome
                                    ? escapeHTML(t('recurring.action.mark_received', 'Mark Received'))
                                    : escapeHTML(t('recurring.action.mark_paid', 'Mark Paid')))
                                : escapeHTML(t('recurring.action.not_due_yet', 'Not Due Yet'))
                        }
                    </button>
                </td>

                <td>
                    <div class="recurring-row-actions">
                        <button
                            class="dots-btn edit-recurring-btn"
                            data-id="${safeId}"
                            title="Edit recurring payment"
                        >✎</button>
                        <button
                            class="dots-btn delete-recurring-btn"
                            data-id="${safeId}"
                            title="Delete recurring payment"
                        >✕</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    updateRecurringDueThisWeek();

    tbody.querySelectorAll(".recurring-action-btn").forEach(button => {
        button.addEventListener("click", async () => {
            const id = button.dataset.id;
            if (!id) return;

            button.disabled = true;
            button.textContent = t("recurring.action.saving", "Saving...");

            try {
                const res = await fetch(API + `/recurring/${id}/mark-paid`, {
                    method: "POST"
                });

                await throwIfNotOk(res, "Failed to update recurring payment");

                await loadRecurringPayments();
                await loadTransactions();
                await loadDashboard();

                showToast("Recurring payment recorded");
            } catch (error) {
                console.error("Recurring payment error:", error);
                handleFetchError(error, "Could not record recurring payment");
                button.disabled = false;
                button.textContent = "Try again";
            }
        });
    });

    tbody.querySelectorAll(".edit-recurring-btn").forEach(button => {
        button.addEventListener("click", () => {
            const id = button.dataset.id;
            const item = allRecurringPayments.find(row => String(row.id) === String(id));

            if (item) {
                openRecurringModal(item);
            }
        });
    });

    tbody.querySelectorAll(".delete-recurring-btn").forEach(button => {
        button.addEventListener("click", () => {
            openDeleteRecurringModal(button.dataset.id);
        });
    });
}

async function loadRecurringPayments() {
    try {
        const res = await fetch(API + "/recurring");
        await throwIfNotOk(res, 'Recurring request failed');
        const items = await res.json();
        const safeItems = Array.isArray(items) ? items : [];

        allRecurringPayments = safeItems;
        renderRecurringPayments(safeItems);
        updateRecurringStats(safeItems);
    } catch (error) {
        console.error("Error loading recurring payments:", error);
        if (isAuthError(error)) handleUnauthorized();
        if (!SHOW_DEMO_DATA) {
            allRecurringPayments = [];
            renderRecurringPayments([]);
            updateRecurringStats([]);
        }
    }
}

const SUBSCRIPTION_FREQUENCY_DAYS = {
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    quarterly: 91,
    yearly: 365,
};

function nextDateFromLastSeen(lastSeenIso, frequency) {
    const base = lastSeenIso ? new Date(lastSeenIso) : new Date();
    if (Number.isNaN(base.getTime())) return new Date().toISOString().slice(0, 10);
    const step = SUBSCRIPTION_FREQUENCY_DAYS[String(frequency || "").toLowerCase()] || 30;
    base.setDate(base.getDate() + step);
    return base.toISOString().slice(0, 10);
}

function renderDetectedSubscriptions(data) {
    const card = document.getElementById("subscriptionsDetectedCard");
    const summaryEl = document.getElementById("subscriptionsSummary");
    const metaEl = document.getElementById("subscriptionsMeta");
    const statsEl = document.getElementById("subscriptionsStats");
    const listEl = document.getElementById("subscriptionsList");
    if (!card || !summaryEl || !listEl) return;

    const subscriptions = Array.isArray(data && data.subscriptions) ? data.subscriptions : [];
    const cancelCandidates = Array.isArray(data && data.cancel_candidates) ? data.cancel_candidates : [];
    const summary = (data && data.summary) || t("recurring.subs.empty_list", "No detected subscriptions yet.");
    const currency = CURRENT_CURRENCY;
    const totalMonthly = Number((data && data.total_monthly) || 0);
    const activeCount = Number((data && data.active_count) || subscriptions.length);

    summaryEl.textContent = summary;

    if (metaEl) {
        if (data && data.summary_mode === "ai") metaEl.textContent = t("recurring.subs.summary_mode.ai", "AI summary");
        else if (data && data.summary_mode === "cached") metaEl.textContent = t("recurring.subs.summary_mode.cached", "Cached summary");
        else metaEl.textContent = activeCount
            ? t("recurring.subs.summary_mode.rule", "Heuristic summary")
            : t("recurring.subs.summary_mode.empty", "No matches yet");
    }

    if (statsEl) {
        statsEl.hidden = false;
        const setStat = (id, value) => { const n = document.getElementById(id); if (n) n.textContent = value; };
        setStat("subscriptionsActiveCount", String(activeCount));
        setStat("subscriptionsMonthlyTotal", `${currency} ${totalMonthly.toFixed(2)}`);
        setStat("subscriptionsCancelCount", String(cancelCandidates.length));
    }

    if (!subscriptions.length) {
        listEl.innerHTML = `<p class="coach-history-empty">${escapeHTML(t("recurring.subs.empty_list", "No recurring same-amount charges detected. Import more transactions or wait for another billing cycle."))}</p>`;
        return;
    }

    const joinSep = t("recurring.subs.meta_join", " · ");

    listEl.innerHTML = subscriptions.slice(0, 20).map(sub => {
        const stale = Number(sub.days_since_last_charge || 0) >= Number((data && data.stale_threshold_days) || 60);
        const tracked = !!sub.already_tracked;
        const merchant = escapeHTML(sub.merchant || "Unnamed");
        const amount = Number(sub.amount || 0).toFixed(2);
        const monthlyCost = Number(sub.monthly_cost || 0).toFixed(2);
        const freqKey = String(sub.frequency || "monthly").toLowerCase();
        const frequency = sub.frequency || "monthly";
        const freqLabel = formatFrequencyLabel(freqKey);
        const daysAgo = Number(sub.days_since_last_charge || 0);
        const occurrences = Number(sub.occurrences || 0);

        const chargeCountLabel = occurrences === 1
            ? t("recurring.subs.charge.one", "1 charge")
            : t("recurring.subs.charge.many", "{n} charges").replace("{n}", occurrences);

        const lastChargeLabel = daysAgo === 0
            ? t("recurring.subs.charged_today", "charged today")
            : daysAgo === 1
                ? t("recurring.subs.last_charged.one", "last charged 1 day ago")
                : t("recurring.subs.last_charged.many", "last charged {n} days ago").replace("{n}", daysAgo);

        const metaParts = [
            `${freqLabel}${joinSep}${currency} ${monthlyCost}/mo`,
            chargeCountLabel,
            lastChargeLabel,
        ];

        const buttonLabel = tracked
            ? t("recurring.subs.tracked_btn", "Already tracked")
            : t("recurring.subs.track_btn", "Track in recurring");

        return `
            <div class="subscription-item${stale ? ' stale' : ''}">
                <div>
                    <p class="subscription-name">${merchant}</p>
                    <p class="subscription-meta">${escapeHTML(metaParts.join(joinSep))}</p>
                </div>
                <div class="subscription-amount">${escapeHTML(currency)} ${amount}</div>
                <button type="button"
                        class="subscription-action-btn"
                        data-merchant="${merchant}"
                        data-amount="${amount}"
                        data-frequency="${escapeHTML(frequency)}"
                        data-category="${escapeHTML(sub.category || 'Subscriptions')}"
                        data-account="${escapeHTML(sub.account || 'Subscriptions')}"
                        data-last-seen="${escapeHTML(sub.last_seen || '')}"
                        ${tracked ? 'disabled' : ''}>
                    ${escapeHTML(buttonLabel)}
                </button>
            </div>
        `;
    }).join("");

    listEl.querySelectorAll(".subscription-action-btn").forEach(button => {
        if (button.disabled) return;
        button.addEventListener("click", async () => {
            button.disabled = true;
            const original = button.textContent;
            button.textContent = t("recurring.subs.adding_btn", "Adding…");

            const payload = {
                name: button.dataset.merchant,
                amount: button.dataset.amount,
                type: "expense",
                category: button.dataset.category,
                account: button.dataset.account,
                frequency: button.dataset.frequency,
                next_date: nextDateFromLastSeen(button.dataset.lastSeen, button.dataset.frequency),
            };

            try {
                const resp = await fetch(API + "/recurring", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                await throwIfNotOk(resp, t("recurring.subs.add_failed", "Could not add as recurring"));
                button.textContent = t("recurring.subs.added_btn", "Tracked");
                if (typeof loadRecurringPayments === "function") loadRecurringPayments();
                if (typeof showToast === "function") {
                    showToast(t("recurring.subs.tracked_toast", "{name} added to recurring payments").replace("{name}", payload.name));
                }
            } catch (error) {
                handleFetchError(error, t("recurring.subs.add_failed", "Could not add as recurring"));
                button.disabled = false;
                button.textContent = original;
            }
        });
    });
}

async function loadDetectedSubscriptions() {
    const card = document.getElementById("subscriptionsDetectedCard");
    if (!card) return;

    try {
        const lang = encodeURIComponent(CURRENT_LANG || "en");
        const res = await fetch(API + `/subscriptions/detected?lang=${lang}`);
        await throwIfNotOk(res, "Subscriptions request failed");
        const data = await res.json();
        lastDetectedSubscriptionsData = data;
        renderDetectedSubscriptions(data);
    } catch (error) {
        if (isAuthError(error)) { handleUnauthorized(); return; }
        const summaryEl = document.getElementById("subscriptionsSummary");
        const metaEl = document.getElementById("subscriptionsMeta");
        if (summaryEl) summaryEl.textContent = t("recurring.subs.fetch_error", "Couldn't scan for subscriptions right now. Try refreshing.");
        if (metaEl) metaEl.textContent = "";
    }
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
    applyDemoDataMode();
    initializeProfilePictureUpload();
    initializeLogout();
    populateCountryCodes();
    populateCurrencies();
    initializeProfileSave();
    initializeChangePassword();
    initializePreferencesSave();
    initializeBillingActions();
    document.getElementById("resendVerificationBtn")?.addEventListener("click", resendVerificationEmail);
    applyLanguage(CURRENT_LANG);
    handleBillingReturnState();
    refreshAddNewButtonLabel();
    refreshActivePageMeta();
    loadCurrentUserProfile();
    buildIncomeChart();
    buildSpendingChart();
    buildPortfolioChart();
    filtered = [...getTransactionSource()];
    renderTable();
    enhanceRecurringDateCells();
    updateRecurringDueThisWeek();
    loadRecurringPayments();
    loadDetectedSubscriptions();
    setTransactionCategoryFilter('', '🏷️');
    loadCategories();
    loadTransactions();
    loadDashboard();
    loadBudgets();

    const initialTopSearch =
        document.querySelector('.topbar-search') ||
        document.querySelector('.header-search') ||
        document.querySelector('.navbar-search') ||
        document.querySelector('.search-bar');

    if (initialTopSearch) {
        initialTopSearch.style.display = '';
    }

    updateTransactionActionStates();
});

// ==============================
// ADD TRANSACTION MODAL
// ==============================
const transactionModal = document.getElementById("transactionModal");
const addNewBtn = document.getElementById("addNewBtn");
const addTransactionBtn = document.getElementById("addTransactionBtn");
const dashboardAddTransactionBtn = document.getElementById("dashboardAddTransactionBtn");
const investmentPreviewModal = document.getElementById("investmentPreviewModal");
const investmentPreviewClose = document.getElementById("investmentPreviewClose");
const investmentPreviewCancel = document.getElementById("investmentPreviewCancel");
const investmentPreviewContinue = document.getElementById("investmentPreviewContinue");
const investmentComingSoonModal = document.getElementById("investmentComingSoonModal");
const investmentComingSoonClose = document.getElementById("investmentComingSoonClose");
const investmentComingSoonOk = document.getElementById("investmentComingSoonOk");
const transactionModalClose = document.getElementById("transactionModalClose");
const transactionModalCancel = document.getElementById("transactionModalCancel");
const transactionForm = document.getElementById("transactionForm");
const transactionTypeInput = document.getElementById("transactionType");
const transactionTypeExpenseBtn = document.getElementById("transactionTypeExpenseBtn");
const transactionTypeIncomeBtn = document.getElementById("transactionTypeIncomeBtn");
const deleteTransactionModal = document.getElementById("deleteTransactionModal");
const deleteTransactionModalClose = document.getElementById("deleteTransactionModalClose");
const deleteTransactionCancel = document.getElementById("deleteTransactionCancel");
const deleteTransactionConfirm = document.getElementById("deleteTransactionConfirm");
const deleteTransactionIdInput = document.getElementById("deleteTransactionId");
const deleteAllTransactionsModal = document.getElementById("deleteAllTransactionsModal");
const deleteAllTransactionsModalClose = document.getElementById("deleteAllTransactionsModalClose");
const deleteAllTransactionsCancel = document.getElementById("deleteAllTransactionsCancel");
const deleteAllTransactionsConfirm = document.getElementById("deleteAllTransactionsConfirm");

function openInvestmentPreviewModal() {
    if (!investmentPreviewModal) {
        window.fintrackInvestmentPreviewAccepted = true;
        document.querySelector('.nav-item[data-page="investments"]')?.click();
        return;
    }

    investmentPreviewModal.style.display = "flex";
}

function closeInvestmentPreviewModal() {
    if (!investmentPreviewModal) return;
    investmentPreviewModal.style.display = "none";
}

function continueToInvestmentPreview() {
    window.fintrackInvestmentPreviewAccepted = true;
    closeInvestmentPreviewModal();
    document.querySelector('.nav-item[data-page="investments"]')?.click();
}

function openInvestmentComingSoonModal() {
    if (!investmentComingSoonModal) {
        showToast("Investment tracking is coming soon");
        return;
    }

    investmentComingSoonModal.style.display = "flex";
}

function closeInvestmentComingSoonModal() {
    if (!investmentComingSoonModal) return;
    investmentComingSoonModal.style.display = "none";
}

function openTransactionModal() {
    if (!transactionModal) return;
    transactionModal.style.display = "flex";

    const transactionDateInput = document.getElementById("transactionDate");
    if (transactionDateInput && !transactionDateInput.value) {
        transactionDateInput.value = new Date().toISOString().split("T")[0];
    }
}

function setTransactionType(type = "expense") {
    const normalized = type === "income" ? "income" : "expense";

    if (transactionTypeInput) {
        transactionTypeInput.value = normalized;
    }

    if (transactionTypeExpenseBtn) {
        transactionTypeExpenseBtn.classList.toggle("active", normalized === "expense");
    }

    if (transactionTypeIncomeBtn) {
        transactionTypeIncomeBtn.classList.toggle("active", normalized === "income");
    }
}

function openTransactionModal(transaction = null) {
    if (!transactionModal) return;

    const transactionIdInput = document.getElementById("transactionId");
    const transactionModalTitle = document.getElementById("transactionModalTitle");
    const modalDesc = transactionModal.querySelector('.modal-desc');
    const transactionSubmitBtn = document.getElementById("transactionSubmitBtn");
    const transactionNameInput = document.getElementById("transactionName");
    const transactionAmountInput = document.getElementById("transactionAmount");
    const transactionCategoryInput = document.getElementById("transactionCategory");
    const transactionAccountInput = document.getElementById("transactionAccount");
    const transactionDateInput = document.getElementById("transactionDate");

    if (transactionForm) {
        transactionForm.reset();
    }

    if (modalDesc) {
        const descKey = transaction ? 'tx.modal.edit_desc' : 'tx.modal.desc';
        modalDesc.setAttribute('data-i18n', descKey);
        modalDesc.textContent = transaction
            ? t('tx.modal.edit_desc', 'Update this transaction details.')
            : t('tx.modal.desc', 'Add a new income or expense manually.');
    }

    if (transaction) {
        if (transactionIdInput) transactionIdInput.value = transaction.id || "";
        if (transactionModalTitle) {
            transactionModalTitle.setAttribute('data-i18n', 'tx.modal.edit_title');
            transactionModalTitle.textContent = t('tx.modal.edit_title', 'Edit Transaction');
        }
        if (transactionSubmitBtn) {
            transactionSubmitBtn.setAttribute('data-i18n', 'tx.modal.save_changes');
            transactionSubmitBtn.textContent = t('tx.modal.save_changes', 'Save Changes');
        }
        if (transactionNameInput) transactionNameInput.value = transaction.name || "";
        if (transactionAmountInput) transactionAmountInput.value = Math.abs(parseFloat(transaction.amount) || 0);

        setTransactionType((parseFloat(transaction.amount) || 0) >= 0 ? "income" : "expense");

        if (transactionCategoryInput) {
            const categoryName = transaction.category || "Other";
            const categoryIcon = getCategoryIcon(categoryName);
            addCategoryToSelect(categoryName, false, categoryIcon);
            setSelectedTransactionCategory(categoryName, categoryIcon);
        }

        if (transactionAccountInput) {
            const accountValue = transaction.account || "";
            const existingAccount = Array.from(transactionAccountInput.options).some(
                option => option.value === accountValue
            );
            transactionAccountInput.value = existingAccount ? accountValue : "";
        }

        if (transactionDateInput) {
            let rawDate = "";
            if (transaction.date) {
                const parsedDate = new Date(transaction.date);
                if (!Number.isNaN(parsedDate.getTime())) {
                    rawDate = parsedDate.toISOString().split("T")[0];
                }
            }
            transactionDateInput.value = rawDate;
        }
    } else {
        if (transactionIdInput) transactionIdInput.value = "";
        if (transactionModalTitle) {
            transactionModalTitle.setAttribute('data-i18n', 'tx.modal.add_title');
            transactionModalTitle.textContent = t('tx.modal.add_title', 'Add Transaction');
        }
        if (transactionSubmitBtn) {
            transactionSubmitBtn.setAttribute('data-i18n', 'tx.modal.save');
            transactionSubmitBtn.textContent = t('tx.modal.save', 'Save Transaction');
        }
        setTransactionType("expense");
        setSelectedTransactionCategory("", "🏷️");
        if (transactionAccountInput) transactionAccountInput.value = "";
        if (transactionDateInput) {
            transactionDateInput.value = new Date().toISOString().split("T")[0];
        }
    }

    transactionModal.style.display = "flex";
}

function closeTransactionModal() {
    if (!transactionModal) return;

    const transactionIdInput = document.getElementById("transactionId");
    const transactionModalTitle = document.getElementById("transactionModalTitle");
    const transactionSubmitBtn = document.getElementById("transactionSubmitBtn");
    const transactionAccountInput = document.getElementById("transactionAccount");

    transactionModal.style.display = "none";

    if (transactionForm) {
        transactionForm.reset();
    }

    if (transactionIdInput) transactionIdInput.value = "";
    if (transactionModalTitle) {
        transactionModalTitle.setAttribute('data-i18n', 'tx.modal.add_title');
        transactionModalTitle.textContent = t('tx.modal.add_title', 'Add Transaction');
    }
    if (transactionSubmitBtn) {
        transactionSubmitBtn.setAttribute('data-i18n', 'tx.modal.save');
        transactionSubmitBtn.textContent = t('tx.modal.save', 'Save Transaction');
    }
    setTransactionType("expense");
    setSelectedTransactionCategory("", "🏷️");
    if (transactionAccountInput) transactionAccountInput.value = "";
}

function openDeleteTransactionModal(txId) {
    if (!deleteTransactionModal || !deleteTransactionIdInput) return;
    deleteTransactionIdInput.value = txId;
    deleteTransactionModal.style.display = "flex";
}

function closeDeleteTransactionModal() {
    if (!deleteTransactionModal || !deleteTransactionIdInput) return;
    deleteTransactionModal.style.display = "none";
    deleteTransactionIdInput.value = "";
}

function openDeleteAllTransactionsModal() {
    if (!deleteAllTransactionsModal) return;
    deleteAllTransactionsModal.style.display = "flex";
}

function closeDeleteAllTransactionsModal() {
    if (!deleteAllTransactionsModal) return;
    deleteAllTransactionsModal.style.display = "none";
}

if (addNewBtn) {
    addNewBtn.addEventListener("click", () => {
        if (document.body.dataset.activePage === "recurring") {
            openRecurringModal();
            return;
        }

        if (document.body.dataset.activePage === "goals") {
            openGoalModal();
            return;
        }

        if (document.body.dataset.activePage === "investments") {
            openInvestmentComingSoonModal();
            return;
        }

        openTransactionModal();
    });
}

if (investmentPreviewClose) {
    investmentPreviewClose.addEventListener("click", closeInvestmentPreviewModal);
}

if (investmentPreviewCancel) {
    investmentPreviewCancel.addEventListener("click", closeInvestmentPreviewModal);
}

if (investmentPreviewContinue) {
    investmentPreviewContinue.addEventListener("click", continueToInvestmentPreview);
}

if (investmentPreviewModal) {
    investmentPreviewModal.addEventListener("click", (e) => {
        if (e.target === investmentPreviewModal) {
            closeInvestmentPreviewModal();
        }
    });
}

if (investmentComingSoonClose) {
    investmentComingSoonClose.addEventListener("click", closeInvestmentComingSoonModal);
}

if (investmentComingSoonOk) {
    investmentComingSoonOk.addEventListener("click", closeInvestmentComingSoonModal);
}

if (investmentComingSoonModal) {
    investmentComingSoonModal.addEventListener("click", (e) => {
        if (e.target === investmentComingSoonModal) {
            closeInvestmentComingSoonModal();
        }
    });
}

if (addTransactionBtn) {
    addTransactionBtn.addEventListener("click", openTransactionModal);
}

if (dashboardAddTransactionBtn) {
    dashboardAddTransactionBtn.addEventListener("click", openTransactionModal);
}

// "+ Add" on the Accounts card opens the dedicated Add Account modal.
document.getElementById("dashboardAddAccountBtn")?.addEventListener("click", openAccountModal);
initializeAccountModal();

// "+ Add" on the Budget Overview + Savings Goals dashboard cards reuses the
// existing add-budget / add-goal modals from those pages — same form, same
// translations (already covered via data-i18n on those modals), same save
// handlers, so balances and goals refresh through their normal load paths.
document.getElementById("dashboardAddBudgetBtn")?.addEventListener("click", () => openBudgetModal());
document.getElementById("dashboardAddGoalBtn")?.addEventListener("click", () => openGoalModal());

const dashboardScanReceiptBtn = document.getElementById("dashboardScanReceiptBtn");
if (dashboardScanReceiptBtn) {
    dashboardScanReceiptBtn.addEventListener("click", () => {
        if (typeof openScanReceiptModal === "function") {
            openScanReceiptModal();
        } else {
            const scanBtn = document.getElementById("scanReceiptFab");
            if (scanBtn) scanBtn.click();
        }
    });
}

if (transactionModalClose) {
    transactionModalClose.addEventListener("click", closeTransactionModal);
}

if (transactionModalCancel) {
    transactionModalCancel.addEventListener("click", closeTransactionModal);
}

if (transactionModal) {
    transactionModal.addEventListener("click", (e) => {
        if (e.target === transactionModal) {
            closeTransactionModal();
        }
    });
}

if (transactionTypeExpenseBtn) {
    transactionTypeExpenseBtn.addEventListener("click", () => setTransactionType("expense"));
}

if (transactionTypeIncomeBtn) {
    transactionTypeIncomeBtn.addEventListener("click", () => setTransactionType("income"));
}

if (deleteTransactionModalClose) {
    deleteTransactionModalClose.addEventListener("click", closeDeleteTransactionModal);
}

if (deleteTransactionCancel) {
    deleteTransactionCancel.addEventListener("click", closeDeleteTransactionModal);
}

if (deleteTransactionModal) {
    deleteTransactionModal.addEventListener("click", (e) => {
        if (e.target === deleteTransactionModal) {
            closeDeleteTransactionModal();
        }
    });
}

if (deleteAllTransactionsBtn) {
    deleteAllTransactionsBtn.addEventListener("click", () => {
        const currentData = getTransactionSource();

        if (!currentData || currentData.length === 0) {
            showToast('No transactions to delete');
            return;
        }

        openDeleteAllTransactionsModal();
    });
}

if (deleteAllTransactionsModalClose) {
    deleteAllTransactionsModalClose.addEventListener("click", closeDeleteAllTransactionsModal);
}

if (deleteAllTransactionsCancel) {
    deleteAllTransactionsCancel.addEventListener("click", closeDeleteAllTransactionsModal);
}

if (deleteAllTransactionsModal) {
    deleteAllTransactionsModal.addEventListener("click", (e) => {
        if (e.target === deleteAllTransactionsModal) {
            closeDeleteAllTransactionsModal();
        }
    });
}

if (transactionForm) {
    transactionForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const transactionId = document.getElementById("transactionId").value.trim();
        const name = document.getElementById("transactionName").value.trim();
        const amount = parseFloat(document.getElementById("transactionAmount").value);
        const type = document.getElementById("transactionType").value;
        const category = document.getElementById("transactionCategory").value;
        const account = document.getElementById("transactionAccount").value;
        const date = document.getElementById("transactionDate").value;  

        if (!name || !category || !account || !date || Number.isNaN(amount)) {
            alert("Please fill in all fields correctly.");
            return;
        }

        const finalAmount = type === "income" ? Math.abs(amount) : -Math.abs(amount);

        try {
            const isEditing = !!transactionId;

const response = await fetch(
    isEditing
        ? API + `/transactions/${transactionId}`
        : API + "/transactions",
    {
        method: isEditing ? "PUT" : "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name,
            amount: finalAmount,
            category,
            account,
            date,
            source: "manual"
        })
    }
);

            if (!response.ok) {
                throw await getResponseError(response, "Failed to save transaction");
            }

            closeTransactionModal();

            if (typeof loadTransactions === "function") {
                await loadTransactions();
            }

            if (typeof loadDashboard === "function") {
                await loadDashboard();
            }

            showToast(transactionId ? "Transaction updated" : "Transaction added");
        } catch (error) {
            console.error("Error adding transaction:", error);
            handleFetchError(error, transactionId ? "Could not update transaction" : "Could not add transaction");
        }
    });
}

// ==============================
// ADD GOAL MODAL
// ==============================
const goalModal = document.getElementById("goalModal");
const addGoalBtn = document.getElementById("addGoalBtn");
const goalModalClose = document.getElementById("goalModalClose");
const goalModalCancel = document.getElementById("goalModalCancel");
const goalForm = document.getElementById("goalForm");
const deleteGoalModal = document.getElementById("deleteGoalModal");
const deleteGoalModalClose = document.getElementById("deleteGoalModalClose");
const deleteGoalCancel = document.getElementById("deleteGoalCancel");
const deleteGoalConfirm = document.getElementById("deleteGoalConfirm");
const deleteGoalIdInput = document.getElementById("deleteGoalId");
const goalContributionModal = document.getElementById("goalContributionModal");
const goalContributionModalClose = document.getElementById("goalContributionModalClose");
const goalContributionCancel = document.getElementById("goalContributionCancel");
const goalContributionForm = document.getElementById("goalContributionForm");
const goalContributionIdInput = document.getElementById("goalContributionId");
const goalContributionDesc = document.getElementById("goalContributionDesc");
const goalContributionAmountInput = document.getElementById("goalContributionAmount");
const goalContributionDateInput = document.getElementById("goalContributionDate");
const goalContributionNoteInput = document.getElementById("goalContributionNote");
const goalContributionSubmitBtn = document.getElementById("goalContributionSubmit");

async function updateGoalAutoLink(goal, enabled) {
    const manualSaved = goal.manual_saved_amount !== undefined ? goal.manual_saved_amount : goal.saved_amount;
    const category = goal.category || "Savings";

    const response = await fetch(API + `/goals/${goal.id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: goal.name,
            target_amount: goal.target_amount,
            saved_amount: manualSaved || 0,
            deadline: dateInputValue(goal.deadline),
            icon: goal.icon || getCategoryIcon(category) || "🎯",
            category,
            auto_link_savings: enabled
        })
    });

    if (!response.ok) {
        throw await getResponseError(response, "Failed to update auto-link");
    }

    await loadGoals();
}

function updateGoalAutoLinkHint() {
    const goalAutoLinkInput = document.getElementById("goalAutoLinkSavings");
    const goalAutoLinkHint = document.getElementById("goalAutoLinkHint");

    if (goalAutoLinkHint) {
        goalAutoLinkHint.style.display = goalAutoLinkInput && goalAutoLinkInput.checked ? "block" : "none";
    }
}

function openGoalModal(goal = null) {
    if (!goalModal) return;

    const goalIdInput = document.getElementById("goalId");
    const goalModalTitle = document.getElementById("goalModalTitle");
    const goalModalDesc = document.getElementById("goalModalDesc");
    const goalSubmitBtn = document.getElementById("goalSubmitBtn");
    const goalNameInput = document.getElementById("goalName");
    const goalCategoryInput = document.getElementById("goalCategory");
    const goalTargetInput = document.getElementById("goalTargetAmount");
    const goalSavedInput = document.getElementById("goalSavedAmount");
    const goalDeadlineInput = document.getElementById("goalDeadline");
    const goalAutoLinkInput = document.getElementById("goalAutoLinkSavings");

    if (goalForm) {
        goalForm.reset();
    }

    if (goal) {
        if (goalIdInput) goalIdInput.value = goal.id || "";
        if (goalModalTitle) goalModalTitle.textContent = t("goals.modal.edit_title", "Edit Goal");
        if (goalModalDesc) goalModalDesc.textContent = t("goals.modal.edit_desc", "Update this goal and keep your savings plan accurate.");
        if (goalSubmitBtn) goalSubmitBtn.textContent = t("settings.save_changes", "Save Changes");
        if (goalNameInput) goalNameInput.value = goal.name || "";
        if (goalCategoryInput) {
            const categoryName = goal.category || t("goals.default_category", "Savings");
            const categoryIcon = getCategoryIcon(categoryName);
            setSelectedGoalCategory(categoryName, categoryIcon);
        }
        if (goalTargetInput) goalTargetInput.value = goal.target_amount || "";
        if (goalSavedInput) {
            const manualSaved = goal.manual_saved_amount !== undefined ? goal.manual_saved_amount : goal.saved_amount;
            goalSavedInput.value = manualSaved || 0;
        }
        if (goalDeadlineInput) goalDeadlineInput.value = dateInputValue(goal.deadline);
        if (goalAutoLinkInput) goalAutoLinkInput.checked = !!goal.auto_link_savings;
    } else {
        if (goalIdInput) goalIdInput.value = "";
        if (goalModalTitle) goalModalTitle.textContent = t("goals.modal.create_title", "Create Goal");
        if (goalModalDesc) goalModalDesc.textContent = t("goals.modal.create_desc", "Create a new savings goal and track your progress.");
        if (goalSubmitBtn) goalSubmitBtn.textContent = t("goals.modal.save_goal", "Save Goal");
        setSelectedGoalCategory("", "🏷️");
        if (goalSavedInput) goalSavedInput.value = "0";
        if (goalAutoLinkInput) goalAutoLinkInput.checked = true;
    }

    updateGoalAutoLinkHint();
    goalModal.style.display = "flex";
}

function closeGoalModal() {
    if (!goalModal) return;
    goalModal.style.display = "none";

    if (goalForm) {
        goalForm.reset();
    }

    const goalIdInput = document.getElementById("goalId");
    const goalModalTitle = document.getElementById("goalModalTitle");
    const goalModalDesc = document.getElementById("goalModalDesc");
    const goalSubmitBtn = document.getElementById("goalSubmitBtn");

    if (goalIdInput) goalIdInput.value = "";
    if (goalModalTitle) goalModalTitle.textContent = t("goals.modal.create_title", "Create Goal");
    if (goalModalDesc) goalModalDesc.textContent = t("goals.modal.create_desc", "Create a new savings goal and track your progress.");
    if (goalSubmitBtn) goalSubmitBtn.textContent = t("goals.modal.save_goal", "Save Goal");
    setSelectedGoalCategory("", "🏷️");
}

function openGoalContributionModal(goal) {
    if (!goalContributionModal || !goalContributionIdInput) return;

    if (goalContributionForm) {
        goalContributionForm.reset();
    }

    goalContributionIdInput.value = goal.id || "";

    if (goalContributionDesc) {
        const goalLabel = goal.name || t("goals.this_goal", "this goal");
        goalContributionDesc.textContent = t("goals.contrib.desc_for", "Add savings toward {goal}.").replace("{goal}", goalLabel);
    }

    if (goalContributionDateInput) {
        goalContributionDateInput.value = new Date().toISOString().split("T")[0];
    }

    if (goalContributionAmountInput) {
        goalContributionAmountInput.focus();
    }

    goalContributionModal.style.display = "flex";

    setTimeout(() => {
        if (goalContributionAmountInput) goalContributionAmountInput.focus();
    }, 50);
}

function closeGoalContributionModal() {
    if (!goalContributionModal) return;
    goalContributionModal.style.display = "none";

    if (goalContributionForm) {
        goalContributionForm.reset();
    }

    if (goalContributionIdInput) {
        goalContributionIdInput.value = "";
    }
}

function openDeleteGoalModal(goalId) {
    if (!deleteGoalModal || !deleteGoalIdInput) return;
    deleteGoalIdInput.value = goalId || "";
    deleteGoalModal.style.display = "flex";
}

function closeDeleteGoalModal() {
    if (!deleteGoalModal || !deleteGoalIdInput) return;
    deleteGoalModal.style.display = "none";
    deleteGoalIdInput.value = "";
}

if (addGoalBtn) {
    addGoalBtn.addEventListener("click", openGoalModal);
}

document.getElementById("goalsPageAddGoalBtn")?.addEventListener("click", () => openGoalModal());

if (goalModalClose) {
    goalModalClose.addEventListener("click", closeGoalModal);
}

if (goalModalCancel) {
    goalModalCancel.addEventListener("click", closeGoalModal);
}

if (goalModal) {
    goalModal.addEventListener("click", (e) => {
        if (e.target === goalModal) {
            closeGoalModal();
        }
    });
}

document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "goalAutoLinkSavings") {
        updateGoalAutoLinkHint();
    }
});

if (deleteGoalModalClose) {
    deleteGoalModalClose.addEventListener("click", closeDeleteGoalModal);
}

if (deleteGoalCancel) {
    deleteGoalCancel.addEventListener("click", closeDeleteGoalModal);
}

if (deleteGoalModal) {
    deleteGoalModal.addEventListener("click", (e) => {
        if (e.target === deleteGoalModal) {
            closeDeleteGoalModal();
        }
    });
}

if (goalContributionModalClose) {
    goalContributionModalClose.addEventListener("click", closeGoalContributionModal);
}

if (goalContributionCancel) {
    goalContributionCancel.addEventListener("click", closeGoalContributionModal);
}

if (goalContributionModal) {
    goalContributionModal.addEventListener("click", (e) => {
        if (e.target === goalContributionModal) {
            closeGoalContributionModal();
        }
    });
}

if (deleteGoalConfirm) {
    deleteGoalConfirm.addEventListener("click", async () => {
        const goalId = deleteGoalIdInput ? deleteGoalIdInput.value : "";
        if (!goalId) return;

        try {
            const response = await fetch(API + `/goals/${goalId}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                throw await getResponseError(response, "Failed to delete goal");
            }

            closeDeleteGoalModal();
            await loadGoals();
            showToast("Goal deleted");
        } catch (error) {
            console.error("Error deleting goal:", error);
            handleFetchError(error, "Could not delete goal");
        }
    });
}

if (goalForm) {
    goalForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const goalId = document.getElementById("goalId").value.trim();
        const name = document.getElementById("goalName").value.trim();
        const category = document.getElementById("goalCategory").value.trim();
        const icon = getCategoryIcon(category) || "🎯";
        const target_amount = parseFloat(document.getElementById("goalTargetAmount").value);
        const saved_amount = parseFloat(document.getElementById("goalSavedAmount").value);
        const deadline = document.getElementById("goalDeadline").value;
        const auto_link_savings = document.getElementById("goalAutoLinkSavings")?.checked || false;

        if (!name || !category || !deadline || Number.isNaN(target_amount) || Number.isNaN(saved_amount)) {
            alert("Please fill in all goal fields correctly.");
            return;
        }

        try {
            const isEditing = !!goalId;

            const response = await fetch(isEditing ? API + `/goals/${goalId}` : API + "/goals", {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    target_amount,
                    saved_amount,
                    deadline,
                    icon,
                    category,
                    auto_link_savings
                })
            });

            if (!response.ok) {
                throw await getResponseError(response, "Failed to save goal");
            }

            closeGoalModal();

            if (typeof loadGoals === "function") {
                await loadGoals();
            }

            showToast(goalId ? "Goal updated" : "Goal added");
        } catch (error) {
            console.error("Error adding goal:", error);
            handleFetchError(error, "Could not save goal");
        }
    });
}

if (goalContributionForm) {
    goalContributionForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const goalId = goalContributionIdInput ? goalContributionIdInput.value : "";
        const amount = parseFloat(goalContributionAmountInput ? goalContributionAmountInput.value : "");
        const date = goalContributionDateInput ? goalContributionDateInput.value : "";
        const note = goalContributionNoteInput ? goalContributionNoteInput.value.trim() : "";

        if (!goalId || Number.isNaN(amount) || amount <= 0 || !date) {
            showToast("Enter a valid contribution amount");
            return;
        }

        try {
            if (goalContributionSubmitBtn) {
                goalContributionSubmitBtn.disabled = true;
                goalContributionSubmitBtn.textContent = "Adding...";
            }

            const response = await fetch(API + `/goals/${goalId}/contribute`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    amount,
                    date,
                    note
                })
            });

            if (!response.ok) {
                throw await getResponseError(response, "Failed to add contribution");
            }

            closeGoalContributionModal();
            recentGoalSavingsAnimation = {
                goalId,
                amount
            };
            await loadGoals();
            showToast(t("goals.toast.savings_added", "Savings added"));
        } catch (error) {
            console.error("Error adding contribution:", error);
            handleFetchError(error, t("goals.toast.savings_error", "Could not add contribution"));
        } finally {
            if (goalContributionSubmitBtn) {
                goalContributionSubmitBtn.disabled = false;
                goalContributionSubmitBtn.textContent = t("goals.add_savings_btn", "Add Savings");
            }
        }
    });
}
// ==============================
// ADD BUDGET MODAL
// ==============================
const budgetModal = document.getElementById("budgetModal");
const addBudgetBtn = document.getElementById("addBudgetBtn");
const budgetModalClose = document.getElementById("budgetModalClose");
const budgetModalCancel = document.getElementById("budgetModalCancel");
const budgetForm = document.getElementById("budgetForm");
const deleteBudgetBtn = document.getElementById("deleteBudgetBtn");
const viewBudgetTransactionsBtn = document.getElementById("viewBudgetTransactionsBtn");
const budgetRuleCategoryBtn = document.getElementById("budgetRuleCategoryBtn");
const budgetRuleKeywordBtn = document.getElementById("budgetRuleKeywordBtn");
const budgetTrackingRuleInput = document.getElementById("budgetTrackingRule");
const budgetKeywordRow = document.getElementById("budgetKeywordRow");
const budgetMatchKeywordInput = document.getElementById("budgetMatchKeyword");
const deleteBudgetModal = document.getElementById("deleteBudgetModal");
const deleteBudgetModalClose = document.getElementById("deleteBudgetModalClose");
const deleteBudgetCancel = document.getElementById("deleteBudgetCancel");
const deleteBudgetConfirm = document.getElementById("deleteBudgetConfirm");
const deleteBudgetIdInput = document.getElementById("deleteBudgetId");

function setBudgetTrackingRule(rule = "category", keyword = "") {
    const normalized = rule === "keyword" ? "keyword" : "category";

    if (budgetTrackingRuleInput) {
        budgetTrackingRuleInput.value = normalized;
    }

    if (budgetRuleCategoryBtn) {
        budgetRuleCategoryBtn.classList.toggle("active", normalized === "category");
    }

    if (budgetRuleKeywordBtn) {
        budgetRuleKeywordBtn.classList.toggle("active", normalized === "keyword");
    }

    if (budgetKeywordRow) {
        budgetKeywordRow.style.display = normalized === "keyword" ? "flex" : "none";
    }

    if (budgetMatchKeywordInput) {
        budgetMatchKeywordInput.value = normalized === "keyword" ? keyword : "";
    }
}

function parseBudgetDateInput(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const dateValue = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    dateValue.setHours(0, 0, 0, 0);
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
}

function toBudgetDateInputValue(dateValue) {
    if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${dateValue.getFullYear()}-${pad(dateValue.getMonth() + 1)}-${pad(dateValue.getDate())}`;
}

function budgetEndDateFromDays(startDateValue, days) {
    const startDate = parseBudgetDateInput(startDateValue);
    const duration = Number.parseInt(days, 10);
    if (!startDate || Number.isNaN(duration) || duration < 1) return "";
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + duration - 1);
    return toBudgetDateInputValue(endDate);
}

function calculateBudgetDaysFromDates(startDateValue, endDateValue) {
    const startDate = parseBudgetDateInput(startDateValue);
    const endDate = parseBudgetDateInput(endDateValue);
    if (!startDate || !endDate) return NaN;
    return Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
}

function setBudgetDurationPreset(days) {
    document.querySelectorAll(".budget-duration-btn").forEach(btn => {
        btn.classList.toggle("active", String(btn.dataset.days || "") === String(days || ""));
    });
}

function syncBudgetDaysFromDates() {
    const startInput = document.getElementById("budgetStartDate");
    const endInput = document.getElementById("budgetEndDate");
    const daysInput = document.getElementById("budgetDays");
    if (!startInput || !endInput || !daysInput) return NaN;
    const days = calculateBudgetDaysFromDates(startInput.value, endInput.value);
    daysInput.value = Number.isFinite(days) && days > 0 ? String(days) : "";
    return days;
}

function openBudgetModal(budget = null) {
    if (!budgetModal) return;

    const budgetIdInput = document.getElementById("budgetId");
    const budgetModalTitle = document.getElementById("budgetModalTitle");
    const budgetSubmitBtn = document.getElementById("budgetSubmitBtn");
    const budgetCategoryInput = document.getElementById("budgetCategory");
    const budgetAmountInput = document.getElementById("budgetAmount");
    const budgetStartDateInput = document.getElementById("budgetStartDate");
    const budgetDaysInput = document.getElementById("budgetDays");
    const budgetEndDateInput = document.getElementById("budgetEndDate");

    if (budgetForm) {
        budgetForm.reset();
    }

    setBudgetDurationPreset("");

    if (budget) {
        if (deleteBudgetBtn) {
            deleteBudgetBtn.style.display = "inline-flex";
        }

        if (viewBudgetTransactionsBtn) {
            viewBudgetTransactionsBtn.style.display = "inline-flex";
            viewBudgetTransactionsBtn.dataset.category = budget.category || "";
            viewBudgetTransactionsBtn.dataset.keyword = budget.match_keyword || "";
            viewBudgetTransactionsBtn.dataset.startDate = budget.start_date || budget.period_start || "";
            viewBudgetTransactionsBtn.dataset.endDate = budget.end_date || "";
        }

        setBudgetTrackingRule(
            budget.match_keyword ? "keyword" : "category",
            budget.match_keyword || ""
        );

        const categoryName = budget.category || "";
        const categoryIcon = getCategoryIcon(categoryName);

        if (budgetIdInput) budgetIdInput.value = budget.id || "";
        if (budgetModalTitle) budgetModalTitle.textContent = t("budgets.modal.edit_title", "Edit Budget");
        if (budgetSubmitBtn) budgetSubmitBtn.textContent = t("settings.save_changes", "Save Changes");
        if (budgetAmountInput) budgetAmountInput.value = budget.amount || "";

        setSelectedBudgetCategory(categoryName, categoryIcon);

        if (budgetStartDateInput) {
            const rawDate = dateInputValue(budget.start_date || budget.period_start);
            budgetStartDateInput.value = rawDate || new Date().toISOString().split("T")[0];
        }

        const budgetDays = Number.parseInt(budget.period_days || budget.days || 30, 10);
        if (budgetDaysInput) {
            budgetDaysInput.value = Number.isFinite(budgetDays) && budgetDays > 0 ? String(budgetDays) : "30";
        }

        if (budgetEndDateInput) {
            budgetEndDateInput.value = dateInputValue(budget.end_date) || budgetEndDateFromDays(budgetStartDateInput?.value, budgetDays);
        }

        setBudgetDurationPreset(["7", "14", "30", "90"].includes(String(budgetDays)) ? String(budgetDays) : "");
        syncBudgetDaysFromDates();
    } else {
        if (deleteBudgetBtn) {
            deleteBudgetBtn.style.display = "none";
        }

        if (viewBudgetTransactionsBtn) {
            viewBudgetTransactionsBtn.style.display = "none";
            viewBudgetTransactionsBtn.dataset.category = "";
            viewBudgetTransactionsBtn.dataset.keyword = "";
            viewBudgetTransactionsBtn.dataset.startDate = "";
            viewBudgetTransactionsBtn.dataset.endDate = "";
        }

        setBudgetTrackingRule("category", "");

        const now = new Date();

        if (budgetIdInput) budgetIdInput.value = "";
        if (budgetModalTitle) budgetModalTitle.textContent = t("budgets.modal.create_title", "Create Budget");
        if (budgetSubmitBtn) budgetSubmitBtn.textContent = t("budgets.modal.save_budget", "Save Budget");
        setSelectedBudgetCategory("", "🏷️");

        if (budgetStartDateInput) {
            budgetStartDateInput.value = now.toISOString().split("T")[0];
        }

        if (budgetDaysInput) {
            budgetDaysInput.value = "";
        }

        if (budgetEndDateInput) {
            budgetEndDateInput.value = "";
        }

        setBudgetDurationPreset("");
    }

    budgetModal.style.display = "flex";
}

function closeBudgetModal() {
    if (!budgetModal) return;
    budgetModal.style.display = "none";

    if (budgetForm) {
        budgetForm.reset();
    }
}

function openDeleteBudgetModal(budgetId) {
    if (!deleteBudgetModal || !deleteBudgetIdInput) return;
    deleteBudgetIdInput.value = budgetId;
    deleteBudgetModal.style.display = "flex";
}

function closeDeleteBudgetModal() {
    if (!deleteBudgetModal || !deleteBudgetIdInput) return;
    deleteBudgetModal.style.display = "none";
    deleteBudgetIdInput.value = "";
}

if (addBudgetBtn) {
    addBudgetBtn.addEventListener("click", openBudgetModal);
}

if (budgetModalClose) {
    budgetModalClose.addEventListener("click", closeBudgetModal);
}

if (budgetModalCancel) {
    budgetModalCancel.addEventListener("click", closeBudgetModal);
}

if (budgetRuleCategoryBtn) {
    budgetRuleCategoryBtn.addEventListener("click", () => {
        setBudgetTrackingRule("category", "");
    });
}

if (budgetRuleKeywordBtn) {
    budgetRuleKeywordBtn.addEventListener("click", () => {
        setBudgetTrackingRule("keyword", budgetMatchKeywordInput ? budgetMatchKeywordInput.value : "");
    });
}

if (deleteBudgetBtn) {
    deleteBudgetBtn.addEventListener("click", () => {
        const budgetId = document.getElementById("budgetId").value.trim();
        if (!budgetId) return;

        openDeleteBudgetModal(budgetId);
    });
}

if (viewBudgetTransactionsBtn) {
    viewBudgetTransactionsBtn.addEventListener("click", async () => {
        const category = viewBudgetTransactionsBtn.dataset.category || "";
        const keyword = viewBudgetTransactionsBtn.dataset.keyword || "";
        const startDate = viewBudgetTransactionsBtn.dataset.startDate || "";
        const endDate = viewBudgetTransactionsBtn.dataset.endDate || "";

        console.log("Budget related filter:", { category, keyword, startDate, endDate });

        closeBudgetModal();

        document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
        document.querySelector('.nav-item[data-page="transactions"]')?.classList.add('active');

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-transactions')?.classList.add('active');

        if (pageMeta.transactions) {
            document.querySelector('.page-title').textContent = pageMeta.transactions.title;
            document.querySelector('.page-subtitle').textContent = pageMeta.transactions.sub;
        }

        const txSearch = document.getElementById('txSearch');
        const txTypeFilter = document.getElementById('txTypeFilter');
        const txAccountFilter = document.getElementById('txAccountFilter');
        const txSortFilter = document.getElementById('txSortFilter');
        const fromInput = document.getElementById('txDateFromFilter');
        const toInput = document.getElementById('txDateToFilter');

        if (txSearch) {
            txSearch.value = keyword
                ? `${category} / ${keyword}`
                : category;
        }

        if (txTypeFilter) txTypeFilter.value = "expense";
        if (txAccountFilter) txAccountFilter.value = "";
        if (txSortFilter) txSortFilter.value = "date_desc";

        setTransactionCategoryFilter('', '🏷️');

        if (fromInput && startDate) {
            fromInput.value = String(startDate).slice(0, 10);
        }

        if (toInput && endDate) {
            toInput.value = String(endDate).slice(0, 10);
        }

        let source = getTransactionSource();

        try {
            const response = await fetch(API + '/transactions');
            await throwIfNotOk(response, 'Failed to refresh transactions');
            const data = await response.json();

            if (Array.isArray(data)) {
                transactionsLoadedFromBackend = true;
                allTransactions = data;
                source = allTransactions;
                refreshTransactionCategoryOptions();
                refreshTransactionAccountOptions();
            }
        } catch (error) {
            console.warn("Could not refresh transactions before matching budget:", error);
        }

        const normalizeDate = (value) => {
            if (!value) return "";
            const asString = String(value);
            const directMatch = asString.match(/\d{4}-\d{2}-\d{2}/);
            if (directMatch) return directMatch[0];

            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return "";

            const year = parsed.getFullYear();
            const month = String(parsed.getMonth() + 1).padStart(2, "0");
            const day = String(parsed.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };

        const cleanCategory = category.toLowerCase().trim();
        const cleanKeyword = keyword.toLowerCase().trim();
        const cleanStartDate = normalizeDate(startDate);
        const cleanEndDate = normalizeDate(endDate);

        filtered = source.filter(tx => {
            const txName = String(tx.name || "").toLowerCase();
            const txCategory = String(tx.category || "").toLowerCase();
            const txAmount = parseFloat(tx.amount || 0);
            const txDateOnly = normalizeDate(tx.date);

            const categoryMatch =
                cleanCategory && txCategory === cleanCategory;

            const keywordMatch =
                cleanKeyword &&
                (
                    txName.includes(cleanKeyword) ||
                    txCategory.includes(cleanKeyword)
                );

            const matchesDate =
                (!cleanStartDate || txDateOnly >= cleanStartDate) &&
                (!cleanEndDate || txDateOnly <= cleanEndDate);

            return txAmount < 0 && matchesDate && (categoryMatch || keywordMatch);
        });

        filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        currentPage = 1;
        renderTable();
        showToast("Showing matched transactions for this budget");
    });
}

if (budgetModal) {
    budgetModal.addEventListener("click", (e) => {
        if (e.target === budgetModal) {
            closeBudgetModal();
        }
    });
}

if (deleteBudgetModalClose) {
    deleteBudgetModalClose.addEventListener("click", closeDeleteBudgetModal);
}

if (deleteBudgetCancel) {
    deleteBudgetCancel.addEventListener("click", closeDeleteBudgetModal);
}

if (deleteBudgetModal) {
    deleteBudgetModal.addEventListener("click", (e) => {
        if (e.target === deleteBudgetModal) {
            closeDeleteBudgetModal();
        }
    });
}

if (deleteBudgetConfirm) {
    deleteBudgetConfirm.addEventListener("click", async () => {
        const budgetId = deleteBudgetIdInput ? deleteBudgetIdInput.value : "";
        if (!budgetId) return;

        try {
            const response = await fetch(API + "/budgets/" + budgetId, {
                method: "DELETE"
            });

            if (!response.ok) {
                throw await getResponseError(response, "Failed to delete budget");
            }

            closeDeleteBudgetModal();
            closeBudgetModal();
            await loadBudgets();
            showToast("Budget deleted");
        } catch (error) {
            console.error("Error deleting budget:", error);
            handleFetchError(error, "Could not delete budget");
        }
    });
}

if (budgetForm) {
    budgetForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const budgetId = document.getElementById("budgetId").value.trim();
        const category = document.getElementById("budgetCategory").value;
        const amount = parseFloat(document.getElementById("budgetAmount").value);
        const start_date = document.getElementById("budgetStartDate").value;
        const end_date = document.getElementById("budgetEndDate").value;
        const days = syncBudgetDaysFromDates();
        const tracking_rule = document.getElementById("budgetTrackingRule").value;
        const match_keyword = document.getElementById("budgetMatchKeyword").value.trim();

        if (!category || Number.isNaN(amount) || !start_date || !end_date || Number.isNaN(days) || days < 1) {
            showToast("Please fill in all budget fields correctly");
            return;
        }

        try {
            const isEditing = !!budgetId;

            const response = await fetch(
                isEditing
                    ? API + `/budgets/${budgetId}`
                    : API + "/budgets",
                {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    category,
                    amount,
                    start_date,
                    days,
                    tracking_rule,
                    match_keyword: tracking_rule === "keyword" ? match_keyword : ""
                })
                }
            );

            if (!response.ok) {
                throw await getResponseError(response, "Failed to save budget");
            }

            closeBudgetModal();

            if (typeof loadBudgets === "function") {
                await loadBudgets();
            }

            showToast(budgetId ? "Budget updated" : "Budget added");
        } catch (error) {
            console.error("Error adding budget:", error);
            handleFetchError(error, budgetId ? "Could not update budget" : "Could not add budget");
        }
    });
}

// ==============================
// EXPORT TRANSACTIONS TO CSV
// ==============================
function convertTransactionsToCSV(rows) {
    const headers = ["ID", "Name", "Category", "Account", "Date", "Amount"];

    const escapeCSV = (value) => {
        const str = String(value ?? "");
        if (str.includes('"') || str.includes(",") || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const csvRows = [
        headers.join(","),
        ...rows.map(tx => [
            escapeCSV(tx.id),
            escapeCSV(tx.name),
            escapeCSV(tx.category),
            escapeCSV(tx.account),
            escapeCSV(tx.date),
            escapeCSV(tx.amount)
        ].join(","))
    ];

    return csvRows.join("\n");
}

function downloadCSVFile(filename, csvContent) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

async function exportTransactionsToCSV() {
    try {
        let rows = [];

        if (Array.isArray(allTransactions) && allTransactions.length > 0) {
            rows = allTransactions;
        } else {
            const response = await fetch(API + "/transactions");
            if (!response.ok) {
                throw await getResponseError(response, "Failed to load transactions for export");
            }
            rows = await response.json();
        }

        if (!Array.isArray(rows) || rows.length === 0) {
            alert("No transactions available to export.");
            return;
        }

        const csvContent = convertTransactionsToCSV(rows);
        const today = new Date().toISOString().split("T")[0];
        downloadCSVFile(`fintrack-transactions-${today}.csv`, csvContent);
    } catch (error) {
        console.error("Error exporting transactions:", error);
        handleFetchError(error, "Could not export transactions");
    }
}

if (exportTransactionsBtn) {
    exportTransactionsBtn.addEventListener("click", () => {
        if (exportTransactionsBtn.disabled) return;
        exportTransactionsToCSV();
    });
}

// ==============================
// TOAST NOTIFICATIONS
// ==============================
function showToast(message) {
    let toast = document.getElementById('fintrack-toast');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'fintrack-toast';
        toast.style.position = 'fixed';
        toast.style.right = '20px';
        toast.style.bottom = '20px';
        toast.style.padding = '12px 16px';
        toast.style.borderRadius = '12px';
        toast.style.background = 'rgba(17, 24, 39, 0.96)';
        toast.style.color = '#ffffff';
        toast.style.fontSize = '14px';
        toast.style.fontWeight = '600';
        toast.style.boxShadow = '0 12px 30px rgba(0,0,0,0.18)';
        toast.style.zIndex = '99999';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
        toast.style.pointerEvents = 'none';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(window.fintrackToastTimer);
    window.fintrackToastTimer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
    }, 1800);
}
// ==============================
// PREMIUM QUICK ADD CATEGORY
// ==============================
const quickAddCategoryBtn = document.getElementById("quickAddCategoryBtn");
const categoryQuickModal = document.getElementById("categoryQuickModal");
const categoryQuickModalClose = document.getElementById("categoryQuickModalClose");
const categoryQuickModalCancel = document.getElementById("categoryQuickModalCancel");
const categoryQuickForm = document.getElementById("categoryQuickForm");
const quickCategoryName = document.getElementById("quickCategoryName");
const transactionCategorySelect = document.getElementById("transactionCategory");
const quickAddRecurringCategoryBtn = document.getElementById("quickAddRecurringCategoryBtn");
const quickAddGoalCategoryBtn = document.getElementById("quickAddGoalCategoryBtn");

function openCategoryQuickModal() {
    if (!categoryQuickModal) return;
    categoryQuickModal.style.display = "flex";
    if (quickCategoryName) {
        quickCategoryName.value = "";
        setQuickCategoryIcon('🏷️', 'Choose icon');
        setTimeout(() => quickCategoryName.focus(), 50);
    }
}

function closeCategoryQuickModal() {
    if (!categoryQuickModal) return;
    categoryQuickModal.style.display = "none";
    if (categoryQuickForm) {
        categoryQuickForm.reset();
    }
}

function addCategoryToSelect(categoryName, shouldSelect = true, categoryIcon = '🏷️') {
    const cleanName = String(categoryName || '').trim();
    if (!cleanName) return;

    const normalized = cleanName.toLowerCase();

    const existingCategory = allCategories.find(
        cat => String(cat.name || '').trim().toLowerCase() === normalized
    );

    if (!existingCategory) {
        allCategories.push({
            name: cleanName,
            icon: categoryIcon || '🏷️'
        });

        allCategories.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }

    refreshTransactionCategoryOptions();

    if (shouldSelect) {
        setSelectedTransactionCategory(cleanName, categoryIcon || getCategoryIcon(cleanName));
    }

    return cleanName;
}

if (quickAddCategoryBtn) {
    quickAddCategoryBtn.addEventListener("click", () => {
        categoryPickerTarget = "transaction";
        openCategoryQuickModal();
    });
}

if (quickAddRecurringCategoryBtn) {
    quickAddRecurringCategoryBtn.addEventListener("click", () => {
        categoryPickerTarget = "recurring";
        openCategoryQuickModal();
    });
}

if (quickAddGoalCategoryBtn) {
    quickAddGoalCategoryBtn.addEventListener("click", () => {
        categoryPickerTarget = "goal";
        openCategoryQuickModal();
    });
}

if (categoryQuickModalClose) {
    categoryQuickModalClose.addEventListener("click", closeCategoryQuickModal);
}

if (categoryQuickModalCancel) {
    categoryQuickModalCancel.addEventListener("click", closeCategoryQuickModal);
}

if (categoryQuickModal) {
    categoryQuickModal.addEventListener("click", (e) => {
        if (e.target === categoryQuickModal) {
            closeCategoryQuickModal();
        }
    });
}

if (categoryQuickForm) {
    categoryQuickForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const newCategoryName = quickCategoryName.value.trim();

        if (!newCategoryName) {
            alert("Please enter a category name.");
            return;
        }

        try {
            const response = await fetch(API + '/categories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: newCategoryName,
                    icon: quickCategoryIconInput ? quickCategoryIconInput.value : '🏷️'
                })
            });

            if (!response.ok) {
                throw await getResponseError(response, 'Failed to save category');
            }

            const savedCategory = await response.json();
            const savedName = savedCategory.name || newCategoryName;
            const savedIcon = savedCategory.icon || '🏷️';

            addCategoryToSelect(savedName, categoryPickerTarget === "transaction", savedIcon);

            if (categoryPickerTarget === "budget") {
                setSelectedBudgetCategory(savedName, savedIcon);
            }

            if (categoryPickerTarget === "recurring") {
                setSelectedRecurringCategory(savedName, savedIcon);
            }

            if (categoryPickerTarget === "goal") {
                setSelectedGoalCategory(savedName, savedIcon);
            }

            closeCategoryQuickModal();
            renderCategoryPickerGrid('');
            showToast(`Category "${savedName}" added`);
        } catch (error) {
            console.error('Error adding category:', error);
            handleFetchError(error, 'Could not add category');
        }
    });
}

if (deleteTransactionConfirm) {
    deleteTransactionConfirm.addEventListener("click", async () => {
        const txId = deleteTransactionIdInput ? deleteTransactionIdInput.value : "";

        if (!txId) return;

        try {
            const response = await fetch(API + '/transactions/' + txId, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw await getResponseError(response, 'Failed to delete transaction');
            }

            closeDeleteTransactionModal();
            await loadTransactions();
            await loadDashboard();
            showToast('Transaction deleted');
        } catch (error) {
            console.error('Error deleting transaction:', error);
            handleFetchError(error, 'Could not delete transaction');
        }
    });
}

if (deleteAllTransactionsConfirm) {
    deleteAllTransactionsConfirm.addEventListener("click", async () => {
        try {
            const response = await fetch(API + '/transactions', {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw await getResponseError(response, 'Failed to delete all transactions');
            }

            closeDeleteAllTransactionsModal();
            await loadTransactions();
            await loadDashboard();
            showToast('All transactions deleted');
        } catch (error) {
            console.error('Error deleting all transactions:', error);
            handleFetchError(error, 'Could not delete all transactions');
        }
    });
}
// ==============================
// PREMIUM CATEGORY PICKER
// ==============================
const openCategoryPickerBtn = document.getElementById("openCategoryPickerBtn");
const openRecurringCategoryPickerBtn = document.getElementById("openRecurringCategoryPickerBtn");
const openGoalCategoryPickerBtn = document.getElementById("openGoalCategoryPickerBtn");
const categoryPickerModal = document.getElementById("categoryPickerModal");
const categoryPickerModalClose = document.getElementById("categoryPickerModalClose");
const categoryPickerSearch = document.getElementById("categoryPickerSearch");
const categoryPickerGrid = document.getElementById("categoryPickerGrid");
const categoryPickerTitle = document.getElementById("categoryPickerTitle");
const categoryPickerDesc = document.getElementById("categoryPickerDesc");
const transactionCategoryHidden = document.getElementById("transactionCategory");
const transactionCategoryDisplay = document.getElementById("transactionCategoryDisplay");
const transactionCategoryIcon = document.getElementById("transactionCategoryIcon");
const recurringCategoryHidden = document.getElementById("recurringCategory");
const recurringCategoryDisplay = document.getElementById("recurringCategoryDisplay");
const recurringCategoryIcon = document.getElementById("recurringCategoryIcon");
const goalCategoryHidden = document.getElementById("goalCategory");
const goalCategoryDisplay = document.getElementById("goalCategoryDisplay");
const goalCategoryIcon = document.getElementById("goalCategoryIcon");

function setSelectedTransactionCategory(name, icon = '🏷️') {
    const cleanName = String(name || '').trim();

    if (transactionCategoryHidden) {
        transactionCategoryHidden.value = cleanName;
    }

    if (transactionCategoryDisplay) {
        transactionCategoryDisplay.textContent = cleanName || 'Select category';
    }

    if (transactionCategoryIcon) {
        transactionCategoryIcon.textContent = icon || '🏷️';
    }
}

function setSelectedRecurringCategory(name, icon = "🏷️") {
    const cleanName = String(name || "").trim();
    const displayName = cleanName
        ? (typeof translateCategory === "function" ? translateCategory(cleanName) : cleanName)
        : t("recurring.modal.select_category", "Select category");

    if (recurringCategoryHidden) recurringCategoryHidden.value = cleanName;
    if (recurringCategoryDisplay) recurringCategoryDisplay.textContent = displayName;
    if (recurringCategoryIcon) recurringCategoryIcon.textContent = icon || "🏷️";
}

function setSelectedGoalCategory(name, icon = "🏷️") {
    const cleanName = String(name || "").trim();

    if (goalCategoryHidden) goalCategoryHidden.value = cleanName;
    if (goalCategoryDisplay) goalCategoryDisplay.textContent = cleanName ? translateCategory(cleanName) : t("budgets.modal.select_category", "Select category");
    if (goalCategoryIcon) goalCategoryIcon.textContent = icon || "🏷️";
}

function renderCategoryPickerGrid(searchTerm = '') {
    if (!categoryPickerGrid) return;

    const term = String(searchTerm || '').trim().toLowerCase();
    const categories = (allCategories.length > 0 ? allCategories : DEFAULT_CATEGORIES).filter(cat => {
        const name = String(cat.name || '').toLowerCase();
        const icon = String(cat.icon || '').toLowerCase();
        return !term || name.includes(term) || icon.includes(term);
    });

    if (categories.length === 0) {
        categoryPickerGrid.innerHTML = `
            <div class="category-picker-empty">
                ${t('tx.no_categories_found', 'No categories found.')}
            </div>
        `;
        return;
    }

    const selectedValue =
        categoryPickerTarget === "budget"
            ? (budgetCategoryHidden ? budgetCategoryHidden.value : '')
            : categoryPickerTarget === "recurring"
                ? (recurringCategoryHidden ? recurringCategoryHidden.value : '')
                : categoryPickerTarget === "goal"
                    ? (goalCategoryHidden ? goalCategoryHidden.value : '')
                    : (transactionCategoryHidden ? transactionCategoryHidden.value : '');

    categoryPickerGrid.innerHTML = categories.map(cat => {
        const name = cat.name || 'Other';
        const icon = cat.icon || '🏷️';
        const activeClass = String(selectedValue) === String(name) ? 'active' : '';

        return `
            <button
                type="button"
                class="category-picker-card ${activeClass}"
                data-name="${name}"
                data-icon="${icon}"
            >
                <span class="category-picker-card-icon">${icon}</span>
                <span class="category-picker-card-name">${escapeHTML(translateCategory(name))}</span>
            </button>
        `;
    }).join('');

    categoryPickerGrid.querySelectorAll('.category-picker-card').forEach(card => {
        card.addEventListener('click', () => {
            const name = card.dataset.name || 'Other';
            const icon = card.dataset.icon || '🏷️';

            if (categoryPickerTarget === "budget") {
                setSelectedBudgetCategory(name, icon);
            } else if (categoryPickerTarget === "recurring") {
                setSelectedRecurringCategory(name, icon);
            } else if (categoryPickerTarget === "goal") {
                setSelectedGoalCategory(name, icon);
            } else {
                setSelectedTransactionCategory(name, icon);
            }

            closeCategoryPickerModal();
        });
    });
}

function openCategoryPickerModal() {
    if (!categoryPickerModal) return;

    const contextKeyMap = {
        transaction: 'category_picker.ctx.transaction',
        budget: 'category_picker.ctx.budget',
        recurring: 'category_picker.ctx.recurring',
        goal: 'category_picker.ctx.goal'
    };
    const contextFallback = {
        transaction: 'this transaction',
        budget: 'this budget',
        recurring: 'this recurring payment',
        goal: 'this goal'
    };
    const contextLabel = t(
        contextKeyMap[categoryPickerTarget] || 'category_picker.ctx.default',
        contextFallback[categoryPickerTarget] || 'this item'
    );

    if (categoryPickerTitle) {
        categoryPickerTitle.textContent = t('category_picker.title', 'Choose Category');
    }

    if (categoryPickerDesc) {
        const descTpl = t('category_picker.desc', 'Select a category for {ctx}.');
        categoryPickerDesc.textContent = descTpl.replace('{ctx}', contextLabel);
    }

    categoryPickerModal.style.display = 'flex';
    renderCategoryPickerGrid(categoryPickerSearch ? categoryPickerSearch.value : '');

    if (categoryPickerSearch) {
        categoryPickerSearch.value = '';
        setTimeout(() => categoryPickerSearch.focus(), 50);
    }
}

function closeCategoryPickerModal() {
    if (!categoryPickerModal) return;
    categoryPickerModal.style.display = 'none';

    if (categoryPickerSearch) {
        categoryPickerSearch.value = '';
    }
}

if (openCategoryPickerBtn) {
    openCategoryPickerBtn.addEventListener('click', () => {
        categoryPickerTarget = "transaction";
        openCategoryPickerModal();
    });
}

if (openRecurringCategoryPickerBtn) {
    openRecurringCategoryPickerBtn.addEventListener("click", () => {
        categoryPickerTarget = "recurring";
        openCategoryPickerModal();
    });
}

if (openGoalCategoryPickerBtn) {
    openGoalCategoryPickerBtn.addEventListener("click", () => {
        categoryPickerTarget = "goal";
        openCategoryPickerModal();
    });
}

if (categoryPickerModalClose) {
    categoryPickerModalClose.addEventListener('click', closeCategoryPickerModal);
}

if (categoryPickerModal) {
    categoryPickerModal.addEventListener('click', (e) => {
        if (e.target === categoryPickerModal) {
            closeCategoryPickerModal();
        }
    });
}

if (categoryPickerSearch) {
    categoryPickerSearch.addEventListener('input', (e) => {
        renderCategoryPickerGrid(e.target.value);
    });
}
// ==============================
// CATEGORY ICON PICKER
// ==============================
const openCategoryIconPickerBtn = document.getElementById("openCategoryIconPickerBtn");
const categoryIconPickerModal = document.getElementById("categoryIconPickerModal");
const categoryIconPickerModalClose = document.getElementById("categoryIconPickerModalClose");
const categoryIconPickerSearch = document.getElementById("categoryIconPickerSearch");
const categoryIconPickerGrid = document.getElementById("categoryIconPickerGrid");
const categoryIconPickerPopularGrid = document.getElementById("categoryIconPickerPopularGrid");
const quickCategoryIconPreviewLarge = document.getElementById("quickCategoryIconPreviewLarge");
const quickCategoryIconPreviewName = document.getElementById("quickCategoryIconPreviewName");
const customCategoryEmoji = document.getElementById("customCategoryEmoji");
const applyCustomEmojiBtn = document.getElementById("applyCustomEmojiBtn");
const quickCategoryIconInput = document.getElementById("quickCategoryIcon");
const quickCategoryIconPreview = document.getElementById("quickCategoryIconPreview");
const quickCategoryIconLabel = document.getElementById("quickCategoryIconLabel");

const CATEGORY_ICON_SET = [
    { icon: '🏷️', label: 'Tag' },
    { icon: '💰', label: 'Income' },
    { icon: '💵', label: 'Cash' },
    { icon: '🏦', label: 'Bank' },
    { icon: '📈', label: 'Investment' },
    { icon: '📉', label: 'Loss' },
    { icon: '💳', label: 'Card' },
    { icon: '🧾', label: 'Bills' },
    { icon: '🛒', label: 'Groceries' },
    { icon: '🛍️', label: 'Shopping' },
    { icon: '🍽️', label: 'Dining' },
    { icon: '☕', label: 'Coffee' },
    { icon: '🍔', label: 'Food' },
    { icon: '🍕', label: 'Pizza' },
    { icon: '🧋', label: 'Bubble Tea' },
    { icon: '🍜', label: 'Noodles' },
    { icon: '🚗', label: 'Car' },
    { icon: '⛽', label: 'Fuel' },
    { icon: '🚌', label: 'Bus' },
    { icon: '🚕', label: 'Taxi' },
    { icon: '🚆', label: 'Train' },
    { icon: '✈️', label: 'Travel' },
    { icon: '🏠', label: 'Housing' },
    { icon: '🛏️', label: 'Rent' },
    { icon: '⚡', label: 'Electricity' },
    { icon: '💧', label: 'Water' },
    { icon: '📶', label: 'Internet' },
    { icon: '📱', label: 'Phone' },
    { icon: '💊', label: 'Health' },
    { icon: '🏥', label: 'Medical' },
    { icon: '💪', label: 'Fitness' },
    { icon: '🧠', label: 'Therapy' },
    { icon: '🎬', label: 'Movies' },
    { icon: '🎵', label: 'Music' },
    { icon: '🎮', label: 'Games' },
    { icon: '🎁', label: 'Gifts' },
    { icon: '📚', label: 'Education' },
    { icon: '💼', label: 'Work' },
    { icon: '🎨', label: 'Art' },
    { icon: '🐶', label: 'Pets' },
    { icon: '🐱', label: 'Cat' },
    { icon: '👶', label: 'Kids' },
    { icon: '🧸', label: 'Baby' },
    { icon: '📦', label: 'Packages' },
    { icon: '🧹', label: 'Home Care' },
    { icon: '🌿', label: 'Garden' }
];

const CATEGORY_ICON_POPULAR = [
    { icon: '💰', label: 'Income' },
    { icon: '🛒', label: 'Groceries' },
    { icon: '🍽️', label: 'Dining' },
    { icon: '🚗', label: 'Transport' },
    { icon: '🏠', label: 'Housing' },
    { icon: '⚡', label: 'Bills' },
    { icon: '💊', label: 'Health' },
    { icon: '🛍️', label: 'Shopping' },
    { icon: '🎬', label: 'Entertainment' },
    { icon: '✈️', label: 'Travel' }
];

function setQuickCategoryIcon(icon, label = 'Choose icon') {
    const finalIcon = icon || '🏷️';
    const finalLabel = label || 'Choose icon';

    if (quickCategoryIconInput) quickCategoryIconInput.value = finalIcon;
    if (quickCategoryIconPreview) quickCategoryIconPreview.textContent = finalIcon;
    if (quickCategoryIconLabel) quickCategoryIconLabel.textContent = finalLabel;
    if (quickCategoryIconPreviewLarge) quickCategoryIconPreviewLarge.textContent = finalIcon;
    if (quickCategoryIconPreviewName) quickCategoryIconPreviewName.textContent = finalLabel;
}

function renderCategoryIconPickerGrid(searchTerm = '') {
    const term = String(searchTerm || '').trim().toLowerCase();
    const selectedIcon = quickCategoryIconInput ? quickCategoryIconInput.value : '🏷️';

    const allIcons = CATEGORY_ICON_SET.filter(item => {
        const icon = String(item.icon || '').toLowerCase();
        const label = String(item.label || '').toLowerCase();
        return !term || icon.includes(term) || label.includes(term);
    });

    const popularIcons = CATEGORY_ICON_POPULAR.filter(item => {
        const icon = String(item.icon || '').toLowerCase();
        const label = String(item.label || '').toLowerCase();
        return !term || icon.includes(term) || label.includes(term);
    });

    if (categoryIconPickerPopularGrid) {
        categoryIconPickerPopularGrid.innerHTML = popularIcons.map(item => `
            <button
                type="button"
                class="category-picker-card ${selectedIcon === item.icon ? 'active' : ''}"
                data-icon="${item.icon}"
                data-label="${item.label}"
            >
                <span class="category-picker-card-icon">${item.icon}</span>
                <span class="category-picker-card-name">${item.label}</span>
            </button>
        `).join('');
    }

    if (categoryIconPickerGrid) {
        if (allIcons.length === 0) {
            categoryIconPickerGrid.innerHTML = `
                <div class="category-picker-empty">
                    No icons found.
                </div>
            `;
        } else {
            categoryIconPickerGrid.innerHTML = allIcons.map(item => `
                <button
                    type="button"
                    class="category-picker-card ${selectedIcon === item.icon ? 'active' : ''}"
                    data-icon="${item.icon}"
                    data-label="${item.label}"
                >
                    <span class="category-picker-card-icon">${item.icon}</span>
                    <span class="category-picker-card-name">${item.label}</span>
                </button>
            `).join('');
        }
    }

    document.querySelectorAll('#categoryIconPickerPopularGrid .category-picker-card, #categoryIconPickerGrid .category-picker-card')
        .forEach(card => {
            card.addEventListener('click', () => {
                const icon = card.dataset.icon || '🏷️';
                const label = card.dataset.label || 'Choose icon';
                setQuickCategoryIcon(icon, label);
                closeCategoryIconPickerModal();
            });
        });
}

function openCategoryIconPickerModal() {
    if (!categoryIconPickerModal) return;

    categoryIconPickerModal.style.display = 'flex';

    if (categoryIconPickerSearch) {
        categoryIconPickerSearch.value = '';
    }

    if (customCategoryEmoji) {
        customCategoryEmoji.value = '';
    }

    renderCategoryIconPickerGrid('');
    setTimeout(() => {
        if (categoryIconPickerSearch) categoryIconPickerSearch.focus();
    }, 50);
}

function closeCategoryIconPickerModal() {
    if (!categoryIconPickerModal) return;
    categoryIconPickerModal.style.display = 'none';
    if (categoryIconPickerSearch) categoryIconPickerSearch.value = '';
}

if (openCategoryIconPickerBtn) {
    openCategoryIconPickerBtn.addEventListener('click', openCategoryIconPickerModal);
}

if (categoryIconPickerModalClose) {
    categoryIconPickerModalClose.addEventListener('click', closeCategoryIconPickerModal);
}

if (categoryIconPickerModal) {
    categoryIconPickerModal.addEventListener('click', (e) => {
        if (e.target === categoryIconPickerModal) {
            closeCategoryIconPickerModal();
        }
    });
}

if (categoryIconPickerSearch) {
    categoryIconPickerSearch.addEventListener('input', (e) => {
        renderCategoryIconPickerGrid(e.target.value);
    });
}

if (applyCustomEmojiBtn) {
    applyCustomEmojiBtn.addEventListener('click', () => {
        const emoji = customCategoryEmoji ? customCategoryEmoji.value.trim() : '';

        if (!emoji) {
            alert('Please paste an emoji first.');
            return;
        }

        setQuickCategoryIcon(emoji, 'Custom emoji');
        closeCategoryIconPickerModal();
    });
}

// ==============================
// PREMIUM TRANSACTIONS CATEGORY FILTER
// ==============================
const txCategoryFilterModal = document.getElementById("txCategoryFilterModal");
const txCategoryFilterModalClose = document.getElementById("txCategoryFilterModalClose");
const txCategoryFilterSearch = document.getElementById("txCategoryFilterSearch");
const txCategoryFilterGrid = document.getElementById("txCategoryFilterGrid");
const txCategoryFilterHidden = document.getElementById("txCategoryFilter");
const txCategoryFilterDisplay = document.getElementById("txCategoryFilterDisplay");
const txCategoryFilterIcon = document.getElementById("txCategoryFilterIcon");

function setTransactionCategoryFilter(name = "", icon = "🏷️") {
    if (txCategoryFilterHidden) {
        txCategoryFilterHidden.value = name;
    }

    if (txCategoryFilterDisplay) {
        txCategoryFilterDisplay.textContent = name ? translateCategory(name) : t('tx.all_categories', 'All Categories');
    }

    if (txCategoryFilterIcon) {
        txCategoryFilterIcon.textContent = name ? (icon || "🏷️") : "🏷️";
    }
}

function getFilterCategories() {
    const backendCategories = allCategories.map(cat => ({
        name: cat.name,
        icon: cat.icon || "🏷️"
    }));

    const txOnlyCategories = getTransactionSource()
        .map(tx => String(tx.category || "").trim())
        .filter(Boolean)
        .filter(name => !backendCategories.some(cat => String(cat.name).toLowerCase() === name.toLowerCase()))
        .map(name => ({
            name,
            icon: getCategoryIcon(name)
        }));

    return [
        { name: "", icon: "🏷️", label: "All Categories" },
        ...backendCategories,
        ...txOnlyCategories
    ].sort((a, b) => {
        if (!a.name) return -1;
        if (!b.name) return 1;
        return String(a.name).localeCompare(String(b.name));
    });
}

function renderTxCategoryFilterGrid(searchTerm = "") {
    if (!txCategoryFilterGrid) return;

    const term = String(searchTerm || "").trim().toLowerCase();
    const selectedValue = txCategoryFilterHidden ? txCategoryFilterHidden.value : "";
    const categories = getFilterCategories().filter(cat => {
        const name = String(cat.name || cat.label || "").toLowerCase();
        const icon = String(cat.icon || "").toLowerCase();
        return !term || name.includes(term) || icon.includes(term);
    });

    if (categories.length === 0) {
        txCategoryFilterGrid.innerHTML = `
            <div class="category-picker-empty">
                ${t('tx.no_categories_found', 'No categories found.')}
            </div>
        `;
        return;
    }

    txCategoryFilterGrid.innerHTML = categories.map(cat => {
        const rawName = cat.name || "";
        const displayName = rawName
            ? translateCategory(rawName)
            : t('tx.all_categories', 'All Categories');
        const activeClass = String(selectedValue) === String(rawName) ? "active" : "";

        return `
            <button
                type="button"
                class="category-picker-card ${activeClass}"
                data-name="${escapeHTML(rawName)}"
                data-icon="${cat.icon || '🏷️'}"
            >
                <span class="category-picker-card-icon">${cat.icon || "🏷️"}</span>
                <span class="category-picker-card-name">${escapeHTML(displayName)}</span>
            </button>
        `;
    }).join("");

    txCategoryFilterGrid.querySelectorAll(".category-picker-card").forEach(card => {
        card.addEventListener("click", () => {
            const name = card.dataset.name || "";
            const icon = card.dataset.icon || "🏷️";

            setTransactionCategoryFilter(name, icon);
            closeTxCategoryFilterModal();
            applyFilters();
        });
    });
}

function openTxCategoryFilterModal() {
    if (!txCategoryFilterModal) return;

    txCategoryFilterModal.style.display = "flex";

    if (txCategoryFilterSearch) {
        txCategoryFilterSearch.value = "";
    }

    renderTxCategoryFilterGrid("");

    setTimeout(() => {
        if (txCategoryFilterSearch) txCategoryFilterSearch.focus();
    }, 50);
}

function closeTxCategoryFilterModal() {
    if (!txCategoryFilterModal) return;

    txCategoryFilterModal.style.display = "none";

    if (txCategoryFilterSearch) {
        txCategoryFilterSearch.value = "";
    }
}

if (openTxCategoryFilterBtn) {
    openTxCategoryFilterBtn.addEventListener("click", openTxCategoryFilterModal);
}

if (txCategoryFilterModalClose) {
    txCategoryFilterModalClose.addEventListener("click", closeTxCategoryFilterModal);
}

if (txCategoryFilterModal) {
    txCategoryFilterModal.addEventListener("click", (e) => {
        if (e.target === txCategoryFilterModal) {
            closeTxCategoryFilterModal();
        }
    });
}

if (txCategoryFilterSearch) {
    txCategoryFilterSearch.addEventListener("input", (e) => {
        renderTxCategoryFilterGrid(e.target.value);
    });
}

// ==============================
// BUDGET CATEGORY PICKER
// ==============================
const openBudgetCategoryPickerBtn = document.getElementById("openBudgetCategoryPickerBtn");
const quickAddBudgetCategoryBtn = document.getElementById("quickAddBudgetCategoryBtn");
const budgetCategoryHidden = document.getElementById("budgetCategory");
const budgetCategoryDisplay = document.getElementById("budgetCategoryDisplay");
const budgetCategoryIcon = document.getElementById("budgetCategoryIcon");

let categoryPickerTarget = "transaction";

function setSelectedBudgetCategory(name, icon = "🏷️") {
    const cleanName = String(name || "").trim();

    if (budgetCategoryHidden) budgetCategoryHidden.value = cleanName;
    if (budgetCategoryDisplay) budgetCategoryDisplay.textContent = cleanName ? translateCategory(cleanName) : t("budgets.modal.select_category", "Select category");
    if (budgetCategoryIcon) budgetCategoryIcon.textContent = icon || "🏷️";
}

if (openBudgetCategoryPickerBtn) {
    openBudgetCategoryPickerBtn.addEventListener("click", () => {
        categoryPickerTarget = "budget";
        openCategoryPickerModal();
    });
}

if (quickAddBudgetCategoryBtn) {
    quickAddBudgetCategoryBtn.addEventListener("click", () => {
        categoryPickerTarget = "budget";
        openCategoryQuickModal();
    });
}

// ==============================
// BUDGET DURATION PRESETS
// ==============================
document.querySelectorAll(".budget-duration-btn").forEach(button => {
    button.addEventListener("click", () => {
        const days = button.dataset.days;
        const budgetStartDateInput = document.getElementById("budgetStartDate");
        const budgetEndDateInput = document.getElementById("budgetEndDate");
        const budgetDaysInput = document.getElementById("budgetDays");

        if (days) {
            if (budgetDaysInput) budgetDaysInput.value = days;
            if (budgetStartDateInput && budgetEndDateInput) {
                budgetEndDateInput.value = budgetEndDateFromDays(budgetStartDateInput.value, days);
            }
        } else if (budgetDaysInput) {
            syncBudgetDaysFromDates();
        }

        setBudgetDurationPreset(days);
    });
});

document.getElementById("budgetStartDate")?.addEventListener("change", () => {
    const activePreset = document.querySelector(".budget-duration-btn.active")?.dataset.days || "";
    const endInput = document.getElementById("budgetEndDate");
    const startInput = document.getElementById("budgetStartDate");
    if (activePreset && startInput && endInput) {
        endInput.value = budgetEndDateFromDays(startInput.value, activePreset);
    }
    syncBudgetDaysFromDates();
});

document.getElementById("budgetEndDate")?.addEventListener("change", () => {
    syncBudgetDaysFromDates();
    setBudgetDurationPreset("");
});

// ==============================
// MONEY COACH UI
// ==============================
let currentMoneyCoachHistoryId = null;
let currentMoneyCoachFeedback = "";

async function fetchMoneyCoachJson(endpoint) {
    const response = await fetch(API + endpoint);
    await throwIfNotOk(response, `Could not load ${endpoint}`);
    return response.json();
}

function setCoachText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function getCoachMonthTransactions(transactions) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return (Array.isArray(transactions) ? transactions : []).filter(tx => {
        const txDate = tx.date ? new Date(tx.date) : null;
        return txDate &&
            !Number.isNaN(txDate.getTime()) &&
            txDate.getMonth() === currentMonth &&
            txDate.getFullYear() === currentYear;
    });
}

function getCoachDaysUntil(dateValue) {
    const due = dateValue ? new Date(dateValue) : null;
    if (!due || Number.isNaN(due.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

function updateCoachDataPill(id, isConnected) {
    const el = document.getElementById(id);
    if (!el) return;

    el.classList.toggle("connected", Boolean(isConnected));
    el.classList.toggle("muted", !isConnected);
}

const SAFE_TO_SPEND_STATUS_MAP = {
    "Needs data":   { key: "coach.safe.status.needs_data", fallback: "Needs data" },
    "Wait":         { key: "coach.safe.status.wait",       fallback: "Wait" },
    "Careful":      { key: "coach.safe.status.careful",    fallback: "Careful" },
    "Looks safe":   { key: "coach.safe.status.looks_safe", fallback: "Looks safe" },
};
const SAFE_TO_SPEND_NOTE_MAP = {
    "After budgets, bills, and goals.": { key: "coach.safe.after", fallback: "After budgets, bills, and goals." },
    "Add transactions, budgets, bills, or goals to sharpen this number.": {
        key: "coach.safe.needs_data_note",
        fallback: "Add transactions, budgets, bills, or goals to sharpen this number.",
    },
};

function localizeSafeToSpendStatus(raw) {
    if (!raw) return "";
    const map = SAFE_TO_SPEND_STATUS_MAP[raw];
    return map ? t(map.key, map.fallback) : raw;
}

function localizeSafeToSpendNote(raw) {
    if (!raw) return "";
    const map = SAFE_TO_SPEND_NOTE_MAP[raw];
    return map ? t(map.key, map.fallback) : raw;
}

function renderMoneyCoachSafeToSpend(snapshot) {
    const valueEl = document.getElementById("coachSafeSpendValue");
    const noteEl = document.getElementById("coachSafeSpendNote");

    if (!valueEl || !noteEl || !snapshot) return;

    const amount = parseFloat(snapshot.amount ?? snapshot.affordability?.safe_to_spend ?? 0);
    const statusRaw = String(snapshot.status || "").trim();
    const noteRaw = String(snapshot.note || "After budgets, bills, and goals.").trim();
    const status = localizeSafeToSpendStatus(statusRaw);
    const note = localizeSafeToSpendNote(noteRaw);

    valueEl.textContent = fmt(amount);
    valueEl.classList.toggle("positive", amount > 0);
    valueEl.classList.toggle("negative", amount <= 0);
    noteEl.textContent = status ? `${status} · ${note}` : note;
    noteEl.className = amount <= 0 ? "stat-change negative" : "stat-change positive";
}

async function loadMoneyCoachSafeToSpend() {
    try {
        const snapshot = await fetchMoneyCoachJson("/money-coach/safe-to-spend");
        renderMoneyCoachSafeToSpend(snapshot);
    } catch (error) {
        if (isAuthError(error)) {
            handleUnauthorized();
            return;
        }

        console.error("Money Coach safe-to-spend error:", error);
    }
}

function updateMoneyCoachBrief(data = {}) {
    const transactions = Array.isArray(data.transactions)
        ? data.transactions
        : (Array.isArray(allTransactions) && allTransactions.length ? allTransactions : getTransactionSource());
    const budgets = Array.isArray(data.budgets) ? data.budgets : allBudgets;
    const goals = Array.isArray(data.goals) ? data.goals : allGoals;
    const recurring = Array.isArray(data.recurring) ? data.recurring : allRecurringPayments;
    const investments = Array.isArray(data.investments?.holdings)
        ? data.investments.holdings
        : allInvestmentHoldings;

    const monthTx = getCoachMonthTransactions(transactions);
    const monthlyIncome = monthTx
        .filter(tx => parseFloat(tx.amount || 0) > 0)
        .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    const monthlyExpenses = Math.abs(monthTx
        .filter(tx => parseFloat(tx.amount || 0) < 0)
        .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0));
    const monthlyNet = monthlyIncome - monthlyExpenses;

    const overBudget = (Array.isArray(budgets) ? budgets : [])
        .map(budget => {
            const amount = parseFloat(budget.amount || 0);
            const spent = parseFloat(budget.spent || 0);
            return {
                category: budget.category || "Budget",
                amount,
                spent,
                over: Math.max(spent - amount, 0),
                remaining: Math.max(amount - spent, 0)
            };
        })
        .filter(budget => budget.over > 0)
        .sort((a, b) => b.over - a.over);

    const upcomingBills = (Array.isArray(recurring) ? recurring : [])
        .map(item => ({
            name: item.name || "Recurring payment",
            amount: parseFloat(item.amount || 0),
            daysLeft: getCoachDaysUntil(item.next_date)
        }))
        .filter(item => item.amount < 0 && item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= 14)
        .sort((a, b) => a.daysLeft - b.daysLeft);

    const activeGoals = (Array.isArray(goals) ? goals : [])
        .map(goal => {
            const target = parseFloat(goal.target_amount || 0);
            const saved = parseFloat(goal.effective_saved_amount ?? goal.saved_amount ?? 0);
            return {
                name: goal.name || "Goal",
                target,
                saved,
                remaining: Math.max(target - saved, 0),
                deadline: goal.deadline
            };
        })
        .filter(goal => goal.target > 0 && goal.remaining > 0)
        .sort((a, b) => a.remaining - b.remaining);

    const dueSoonTotal = upcomingBills
        .filter(item => item.daysLeft <= 7)
        .reduce((sum, item) => sum + Math.abs(item.amount), 0);
    const overBudgetTotal = overBudget.reduce((sum, item) => sum + item.over, 0);
    const safeRoom = monthlyNet - dueSoonTotal - overBudgetTotal;

    const fillTpl = (key, fallback, vars = {}) => {
        let s = t(key, fallback);
        Object.keys(vars).forEach(k => {
            s = s.split(`{${k}}`).join(vars[k]);
        });
        return s;
    };
    const localCat = (raw) => (typeof translateCategory === "function" ? translateCategory(raw) : raw);

    // Default state — nothing notable.
    let readStatus = "good";
    let readValue = t("coach.read.good", "Good");
    let readNote = t("coach.read.none", "No major pressure found");
    let briefTitle = t("coach.brief.title_steady", "Your money looks steady");
    let briefSummary = t("coach.brief.summary_steady", "Your current data does not show a major warning. Keep checking before larger purchases.");
    let pressureValue = t("coach.pressure.none", "None");
    let pressureNote = t("coach.pressure.none_note", "No urgent pressure detected");
    let pressureText = t("coach.pressure.none_text", "No category or bill stands out as urgent right now.");
    let safeValue = fmt(Math.max(safeRoom, 0));
    let safeNote = t("coach.safe.after", "After budgets, bills, and goals.");
    let bestMove = t("coach.move.steady", "Keep normal spending steady and review before larger purchases.");

    if (overBudget.length) {
        const top = overBudget[0];
        const cat = localCat(top.category);
        readStatus = "focus";
        readValue = t("coach.read.focus", "Needs focus");
        readNote = fillTpl("coach.read.over_budget", "{category} is over budget", { category: cat });
        briefTitle = t("coach.brief.title_attention", "Your budget needs attention");
        briefSummary = fillTpl("coach.brief.summary_attention",
            "{category} is over by {amount}. Pause extra spending there before adding new purchases.",
            { category: cat, amount: fmt(top.over) });
        pressureValue = cat;
        pressureNote = fillTpl("coach.pressure.over_amount", "{amount} over budget", { amount: fmt(top.over) });
        pressureText = fillTpl("coach.pressure.over_text",
            "{category} is the clearest pressure because it has passed its budget.",
            { category: cat });
        safeValue = fmt(0);
        safeNote = t("coach.safe.fix_first", "Fix the over-budget category first");
        bestMove = fillTpl("coach.move.pause_category",
            "Pause extra spending in {category} and ask Money Coach before buying anything optional.",
            { category: cat });
    } else if (upcomingBills.length) {
        const bill = upcomingBills[0];
        readStatus = "review";
        readValue = t("coach.read.review", "Review");
        readNote = fillTpl("coach.read.bill_soon", "{name} is coming up", { name: bill.name });
        briefTitle = t("coach.brief.title_bill", "A bill is coming soon");
        const dueWhen = bill.daysLeft === 0
            ? t("coach.due.today", "today")
            : bill.daysLeft === 1
                ? t("coach.due.one_day", "in 1 day")
                : fillTpl("coach.due.n_days", "in {n} days", { n: bill.daysLeft });
        briefSummary = fillTpl("coach.brief.summary_bill",
            "{name} is due {when}. Keep room for it before making extra purchases.",
            { name: bill.name, when: dueWhen });
        pressureValue = bill.name;
        pressureNote = fillTpl("coach.pressure.due_soon_amount", "{amount} due soon", { amount: fmt(Math.abs(bill.amount)) });
        pressureText = fillTpl("coach.pressure.bill_text", "{name} is the nearest upcoming recurring expense.", { name: bill.name });
        safeValue = fmt(Math.max(safeRoom, 0));
        safeNote = t("coach.safe.bill_room", "Keep room for upcoming bills");
        bestMove = fillTpl("coach.move.reserve_bill",
            "Keep at least {amount} free for {name}.",
            { amount: fmt(Math.abs(bill.amount)), name: bill.name });
    } else if (monthlyNet < 0) {
        readStatus = "review";
        readValue = t("coach.read.review", "Review");
        readNote = t("coach.read.month_negative", "This month is negative");
        briefTitle = t("coach.brief.title_overspend", "Spending is ahead of income");
        briefSummary = fillTpl("coach.brief.summary_overspend",
            "This month is currently {amount} after income and expenses.",
            { amount: signedMoney(monthlyNet) });
        pressureValue = t("coach.pressure.cash_flow", "Cash flow");
        pressureNote = fillTpl("coach.pressure.net_month", "{amount} net this month", { amount: signedMoney(monthlyNet) });
        pressureText = t("coach.pressure.overspend_text", "Your monthly expenses are currently higher than your income.");
        safeValue = fmt(0);
        safeNote = t("coach.safe.fix_net", "Bring monthly net back above zero");
        bestMove = t("coach.move.cut_flex", "Cut one flexible expense before adding new spending.");
    } else if (activeGoals.length) {
        const goal = activeGoals[0];
        readStatus = "good";
        readValue = t("coach.read.good", "Good");
        readNote = t("coach.read.goals_active", "Goals are active");
        briefTitle = t("coach.brief.title_protect_goal", "Protect your next goal");
        briefSummary = fillTpl("coach.brief.summary_goal",
            "{name} still needs {amount}. Keep extra spending from slowing it down.",
            { name: goal.name, amount: fmt(goal.remaining) });
        pressureValue = goal.name;
        pressureNote = fillTpl("coach.pressure.left", "{amount} left", { amount: fmt(goal.remaining) });
        pressureText = fillTpl("coach.pressure.goal_text", "{name} is your closest active goal pressure.", { name: goal.name });
        safeValue = fmt(Math.max(safeRoom, 0));
        safeNote = safeRoom > 250
            ? t("coach.safe.still_protect", "Still protect your goal")
            : t("coach.safe.goal_tight", "Goal room is tight");
        bestMove = fillTpl("coach.move.toward_goal",
            "Move a small amount toward {name} before optional spending.",
            { name: goal.name });
    }

    setCoachText("coachReadValue", readValue);
    setCoachText("coachReadNote", readNote);
    const readNoteEl = document.getElementById("coachReadNote");
    if (readNoteEl) {
        readNoteEl.className =
            readStatus === "focus" ? "stat-change negative" :
            readStatus === "review" ? "stat-change neutral" :
            "stat-change positive";
    }

    setCoachText("coachPressureValue", pressureValue);
    setCoachText("coachPressureNote", pressureNote);
    setCoachText("coachSafeSpendValue", safeValue);
    setCoachText("coachSafeSpendNote", safeNote);
    setCoachText("coachBriefTitle", briefTitle);
    setCoachText("coachBriefSummary", briefSummary);
    setCoachText("coachBiggestPressure", pressureText);
    setCoachText("coachBestMove", bestMove);

    updateCoachDataPill("coachDataTransactions", transactions.length > 0);
    updateCoachDataPill("coachDataBudgets", budgets.length > 0);
    updateCoachDataPill("coachDataGoals", goals.length > 0);
    updateCoachDataPill("coachDataRecurring", recurring.length > 0);
    updateCoachDataPill("coachDataInvestments", investments.length > 0);
}

async function refreshMoneyCoachPage() {
    updateMoneyCoachBrief();
    loadMoneyCoachHistory();
    loadMoneyCoachInsights();

    try {
        const [transactionsResult, budgetsResult, goalsResult, recurringResult, investmentsResult, safeSpendResult] =
            await Promise.allSettled([
                fetchMoneyCoachJson("/transactions"),
                fetchMoneyCoachJson("/budgets"),
                fetchMoneyCoachJson("/goals"),
                fetchMoneyCoachJson("/recurring"),
                fetchMoneyCoachJson("/investments"),
                fetchMoneyCoachJson("/money-coach/safe-to-spend")
            ]);

        [transactionsResult, budgetsResult, goalsResult, recurringResult, investmentsResult, safeSpendResult].forEach(result => {
            if (result.status === "rejected" && isAuthError(result.reason)) {
                handleUnauthorized();
            }
        });

        const transactions = transactionsResult.status === "fulfilled" && Array.isArray(transactionsResult.value)
            ? transactionsResult.value
            : allTransactions;
        const budgets = budgetsResult.status === "fulfilled" && Array.isArray(budgetsResult.value)
            ? budgetsResult.value
            : allBudgets;
        const goals = goalsResult.status === "fulfilled" && Array.isArray(goalsResult.value)
            ? goalsResult.value
            : allGoals;
        const recurring = recurringResult.status === "fulfilled" && Array.isArray(recurringResult.value)
            ? recurringResult.value
            : allRecurringPayments;
        const investments = investmentsResult.status === "fulfilled" && investmentsResult.value
            ? investmentsResult.value
            : { holdings: allInvestmentHoldings };

        updateMoneyCoachBrief({ transactions, budgets, goals, recurring, investments });

        if (safeSpendResult.status === "fulfilled") {
            renderMoneyCoachSafeToSpend(safeSpendResult.value);
        }
    } catch (error) {
        console.error("Money Coach brief error:", error);
        if (isAuthError(error)) handleUnauthorized();
    }
}

function detectMoneyCoachVerdict(shortAnswer) {
    const head = String(shortAnswer || "").trim().toLowerCase();
    if (!head) return null;
    if (/^(yes|oui|sí|si)\b/.test(head)) return "yes";
    if (/^(no|non)\b/.test(head)) return "no";
    if (/^(wait|attendez|attente|espera)\b/.test(head)) return "wait";
    return null;
}

function moneyCoachWhyToList(rawWhy) {
    const lines = String(rawWhy || "")
        .split(/\n+/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => s.replace(/^[\-•*]\s*/, ""));
    if (!lines.length) return "";
    return `<ul class="coach-answer-bullets">${lines.map(l => `<li>${escapeHTML(l)}</li>`).join("")}</ul>`;
}

function stripMoneyCoachMarkdown(text) {
    if (!text) return "";
    return String(text)
        // Strip ** bold ** and *italic* and __bold__ markers, keep inner text.
        .replace(/\*\*([^*]+?)\*\*/g, "$1")
        .replace(/__([^_]+?)__/g, "$1")
        .replace(/\*([^*\n]+?)\*/g, "$1")
        // Collapse stray ** / __ left from unbalanced markdown.
        .replace(/\*\*/g, "")
        .replace(/__/g, "")
        // Trim excessive blank lines.
        .replace(/\n{3,}/g, "\n\n");
}

function formatMoneyCoachAnswer(answer) {
    if (!answer) return "";

    // Strip markdown bold/italic markers the AI sometimes adds around section
    // headers and emphasis (e.g. **Why:**), then parse the three sections.
    const raw = stripMoneyCoachMarkdown(answer);

    // Fallback: no structured sections — render as a single block.
    if (!/Short answer:/i.test(raw)) {
        const safe = escapeHTML(raw).replace(/\n/g, "<br>");
        return `
            <div class="coach-answer-card">
                <div class="coach-answer-section coach-answer-main">
                    <h4 class="coach-answer-label">${escapeHTML(t("coach.answer.label_main", "Money Coach"))}</h4>
                    <p>${safe}</p>
                </div>
            </div>
        `;
    }

    const shortMatch  = raw.match(/Short answer:\s*([\s\S]*?)(?=\n[\s*_]*Why:|$)/i);
    const whyMatch    = raw.match(/Why:\s*([\s\S]*?)(?=\n[\s*_]*Smart next move:|$)/i);
    const moveMatch   = raw.match(/Smart next move:\s*([\s\S]*?)(?=\n[\s*_]*(Educational guidance|Conseil éducatif|Educativa)|$)/i);

    const shortText = shortMatch ? shortMatch[1].trim() : "";
    const whyText   = whyMatch   ? whyMatch[1].trim()   : "";
    const moveText  = moveMatch  ? moveMatch[1].trim()  : "";

    const verdict = detectMoneyCoachVerdict(shortText);
    const verdictLabel = verdict
        ? t(`coach.verdict.${verdict}`, verdict.toUpperCase())
        : "";

    const verdictHtml = verdict ? `
        <div class="coach-verdict coach-verdict-${verdict}">
            <span class="coach-verdict-dot"></span>
            <span class="coach-verdict-label">${escapeHTML(verdictLabel)}</span>
        </div>
    ` : "";

    const whyList = moneyCoachWhyToList(whyText);
    const safeShort = escapeHTML(shortText).replace(/\n/g, "<br>");
    const safeMove  = escapeHTML(moveText).replace(/\n/g, "<br>");

    return `
        <div class="coach-answer-card${verdict ? ` coach-answer-card-${verdict}` : ""}">
            ${verdictHtml}
            <div class="coach-answer-section coach-answer-main">
                <h4 class="coach-answer-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    ${escapeHTML(t("coach.answer.short", "Short answer"))}
                </h4>
                <p>${safeShort}</p>
            </div>
            ${whyList ? `
                <div class="coach-answer-section coach-answer-why">
                    <h4 class="coach-answer-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6"/><path d="M12 9v6"/><circle cx="12" cy="12" r="10"/></svg>
                        ${escapeHTML(t("coach.answer.why", "Why"))}
                    </h4>
                    ${whyList}
                </div>
            ` : ""}
            ${safeMove ? `
                <div class="coach-answer-section coach-answer-next">
                    <h4 class="coach-answer-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        ${escapeHTML(t("coach.answer.next", "Smart next move"))}
                    </h4>
                    <p>${safeMove}</p>
                </div>
            ` : ""}
        </div>
    `;
}

function getMoneyCoachDataUsedCount(dataUsed, key) {
    const value = dataUsed ? dataUsed[key] : null;

    if (typeof value === "number") return value;
    if (value && typeof value === "object" && typeof value.count === "number") return value.count;

    return 0;
}

function renderMoneyCoachDataUsed(dataUsed) {
    const box = document.getElementById("moneyCoachDataUsed");
    const pills = document.getElementById("moneyCoachDataUsedPills");

    if (!box || !pills) return;

    if (!dataUsed) {
        pills.innerHTML = "";
        box.style.display = "none";
        return;
    }

    const entries = [
        [t("coach.data.transactions", "Transactions"), "transactions"],
        [t("coach.data.budgets", "Budgets"), "budgets"],
        [t("coach.data.goals", "Goals"), "goals"],
        [t("coach.data.recurring", "Recurring payments"), "recurring_payments"]
    ];

    pills.innerHTML = entries.map(([label, key]) => {
        const count = getMoneyCoachDataUsedCount(dataUsed, key);
        const statusClass = count > 0 ? "used" : "empty";
        const countText = count === 1
            ? t("coach.data.count_one", "1 item")
            : t("coach.data.count_many", "{n} items").replace("{n}", count);

        return `
            <span class="coach-data-used-pill ${statusClass}">
                ${escapeHTML(label)}
                <strong>${escapeHTML(countText)}</strong>
            </span>
        `;
    }).join("");

    box.style.display = "flex";
}

function renderMoneyCoachFeedback(feedback = "") {
    const box = document.getElementById("moneyCoachFeedback");
    if (!box) return;

    currentMoneyCoachFeedback = feedback || "";
    box.style.display = currentMoneyCoachHistoryId ? "flex" : "none";

    box.querySelectorAll(".coach-feedback-btn").forEach(button => {
        button.classList.toggle("active", button.dataset.feedback === currentMoneyCoachFeedback);
    });
}

function showMoneyCoachSavedAnswer(item) {
    if (!item || !item.answer) return;

    const input = document.getElementById("moneyCoachInput");
    const card = document.getElementById("moneyCoachResponseCard");
    const responseText = document.getElementById("moneyCoachResponseText");
    const status = document.getElementById("moneyCoachStatus");

    if (input && item.question) {
        input.value = item.question;
    }

    if (card) {
        card.style.display = "block";
    }

    if (responseText) {
        responseText.innerHTML = formatMoneyCoachAnswer(item.answer);
    }

    currentMoneyCoachHistoryId = item.id || null;
    renderMoneyCoachDataUsed(item.data_used);
    renderMoneyCoachFeedback(item.feedback || "");

    if (status) {
        status.textContent = item.mode === "fallback"
            ? t("coach.ask.status_saved_local", "Saved local guidance")
            : t("coach.ask.status_saved", "Saved answer");
    }
}

function moneyCoachHistoryPreview(answer) {
    return String(answer || "")
        .replace(/Short answer:/gi, "")
        .replace(/Why:/gi, "")
        .replace(/Smart next move:/gi, "")
        .replace(/\* /g, "• ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 140);
}

function formatMoneyCoachHistoryDate(value) {
    const date = value ? new Date(value) : null;

    if (!date || Number.isNaN(date.getTime())) {
        return "Saved";
    }

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
    });
}

function renderMoneyCoachHistory(rows) {
    const list = document.getElementById("moneyCoachHistoryList");
    const countEl = document.getElementById("moneyCoachHistoryCount");

    if (!list) return;

    const history = Array.isArray(rows) ? rows : [];

    if (countEl) {
        countEl.textContent = history.length === 0
            ? t("coach.history.count_zero", "0 saved")
            : history.length === 1
                ? t("coach.history.count_one", "1 saved")
                : t("coach.history.count_many", "{n} saved").replace("{n}", history.length);
    }

    if (!history.length) {
        list.innerHTML = `
            <div class="coach-empty-illustration">
                <div class="coach-empty-glyph">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <p class="coach-empty-title">${escapeHTML(t("coach.history.empty_title", "No questions yet"))}</p>
                <p class="coach-empty-text">${escapeHTML(t("coach.history.empty", "Ask Money Coach a question to start your history."))}</p>
            </div>
        `;
        return;
    }

    list.innerHTML = history.slice(0, 6).map((item, index) => {
        const question = String(item.question || "Money Coach question");
        const preview = moneyCoachHistoryPreview(item.answer) || "Open this question again to continue.";
        const mode = item.mode === "fallback" ? "Local guidance" : "AI answer";

        return `
            <button type="button" class="coach-history-item" data-history-index="${index}" data-question="${escapeHTML(question)}">
                <span class="coach-history-question">${escapeHTML(question)}</span>
                <span class="coach-history-preview">${escapeHTML(preview)}</span>
                <span class="coach-history-meta">${escapeHTML(formatMoneyCoachHistoryDate(item.created_at))} • ${escapeHTML(mode)}</span>
            </button>
        `;
    }).join("");

    list.querySelectorAll(".coach-history-item").forEach(item => {
        item.addEventListener("click", () => {
            const index = parseInt(item.dataset.historyIndex || "-1", 10);
            showMoneyCoachSavedAnswer(history[index]);
            document.querySelectorAll(".coach-history-item").forEach(row => row.classList.remove("active"));
            item.classList.add("active");
            document.getElementById("moneyCoachInput")?.focus();
        });
    });

    const responseCard = document.getElementById("moneyCoachResponseCard");
    const shouldRestoreLatest = responseCard && responseCard.style.display === "none";

    if (shouldRestoreLatest) {
        showMoneyCoachSavedAnswer(history[0]);
        list.querySelector(".coach-history-item")?.classList.add("active");
    }
}

async function loadMoneyCoachHistory() {
    const list = document.getElementById("moneyCoachHistoryList");
    if (!list) return;

    try {
        const history = await fetchMoneyCoachJson("/money-coach/history");
        renderMoneyCoachHistory(history);
    } catch (error) {
        if (isAuthError(error)) {
            handleUnauthorized();
            return;
        }

        list.innerHTML = '<p class="coach-history-empty">Could not load recent Coach history.</p>';
    }
}

function renderMoneyCoachInsights(rows) {
    const list = document.getElementById("moneyCoachInsightsList");
    const countEl = document.getElementById("moneyCoachInsightsCount");

    if (!list) return;

    const insights = Array.isArray(rows) ? rows : [];

    if (countEl) {
        countEl.textContent = insights.length === 0
            ? t("coach.saved.count_zero", "0 open")
            : insights.length === 1
                ? t("coach.saved.count_one", "1 open")
                : t("coach.saved.count_many", "{n} open").replace("{n}", insights.length);
    }

    if (!insights.length) {
        list.innerHTML = `
            <div class="coach-empty-illustration">
                <div class="coach-empty-glyph coach-empty-glyph-green">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <p class="coach-empty-title">${escapeHTML(t("coach.saved.empty_title", "All clear"))}</p>
                <p class="coach-empty-text">${escapeHTML(t("coach.saved.empty_none", "No saved insights need attention right now."))}</p>
            </div>
        `;
        return;
    }

    const resolveLabel = escapeHTML(t("coach.saved.resolve", "Mark as resolved"));
    list.innerHTML = insights.slice(0, 5).map(item => `
        <div class="coach-saved-insight-item">
            <div>
                <strong>${escapeHTML(item.title || t("coach.saved.fallback_title", "Saved insight"))}</strong>
                <p>${escapeHTML(item.body || "")}</p>
            </div>
            <button type="button" class="coach-insight-resolve-btn" data-insight-id="${escapeHTML(item.id)}">
                ${resolveLabel}
            </button>
        </div>
    `).join("");

    list.querySelectorAll(".coach-insight-resolve-btn").forEach(button => {
        button.addEventListener("click", async () => {
            const insightId = button.dataset.insightId;
            if (!insightId) return;

            button.disabled = true;
            button.textContent = "Resolving...";

            try {
                const response = await fetch(API + `/money-coach/insights/${insightId}/resolve`, {
                    method: "POST"
                });
                await throwIfNotOk(response, "Could not resolve insight");
                button.textContent = "Resolved";
                await loadMoneyCoachInsights();
                showToast("Insight marked as resolved");
            } catch (error) {
                handleFetchError(error, "Could not resolve insight");
                button.disabled = false;
                button.textContent = "Mark as resolved";
            }
        });
    });
}

async function loadMoneyCoachInsights() {
    const list = document.getElementById("moneyCoachInsightsList");
    if (!list) return;

    try {
        const insights = await fetchMoneyCoachJson("/money-coach/insights");
        renderMoneyCoachInsights(insights);
    } catch (error) {
        if (isAuthError(error)) {
            handleUnauthorized();
            return;
        }

        list.innerHTML = '<p class="coach-history-empty">Could not load saved insights.</p>';
    }
}

function dailyInsightTone(item) {
    const directTone = String(item?.tone || "").toLowerCase();
    if (["alert", "warn", "positive", "info"].includes(directTone)) return directTone;

    const raw = String(item?.source || "");
    if (raw.startsWith("daily_scan_")) {
        const sourceTone = raw.slice("daily_scan_".length);
        if (["alert", "warn", "positive", "info"].includes(sourceTone)) return sourceTone;
    }
    return "info";
}

function dailyInsightTypeLabel(type) {
    const labels = {
        spending_alert: "Spending alert",
        subscription_detector: "Subscription detector",
        goal_pacing: "Goal pacing",
    };
    return labels[type] || "Insight";
}

function renderDailyInsights(rows) {
    const list = document.getElementById("dailyInsightsList");
    const meta = document.getElementById("dailyInsightsMeta");
    if (!list) return;

    const items = (Array.isArray(rows) ? rows : []).slice(0, 3);

    if (!items.length) {
        list.innerHTML = '<p class="coach-history-empty">No daily insight cards are ready yet. Try refreshing in a moment.</p>';
        if (meta) meta.textContent = "Waiting for Claude";
        return;
    }

    if (meta) meta.textContent = "Generated from your last 90 days";

    list.innerHTML = items.map(item => {
        const tone = dailyInsightTone(item);
        const typeLabel = dailyInsightTypeLabel(item.insight_type);
        const actionLabel = item.action_label || "Got it";
        return `
            <div class="coach-saved-insight-item daily-insight-${escapeHTML(tone)} daily-insight-card">
                <div>
                    <span class="daily-insight-type">${escapeHTML(typeLabel)}</span>
                    <strong>${escapeHTML(item.title || "Insight")}</strong>
                    <p>${escapeHTML(item.body || "")}</p>
                </div>
                <button type="button" class="coach-insight-resolve-btn" data-insight-id="${escapeHTML(item.id)}">
                    ${escapeHTML(actionLabel)}
                </button>
            </div>
        `;
    }).join("");

    list.querySelectorAll(".coach-insight-resolve-btn").forEach(button => {
        button.addEventListener("click", async () => {
            const insightId = button.dataset.insightId;
            if (!insightId) return;

            button.disabled = true;
            button.textContent = "Dismissing…";

            try {
                const response = await fetch(API + `/insights/${insightId}/resolve`, {
                    method: "POST"
                });
                await throwIfNotOk(response, "Could not dismiss insight");
                await loadDailyInsights();
            } catch (error) {
                handleFetchError(error, "Could not dismiss insight");
                button.disabled = false;
                button.textContent = button.dataset.originalLabel || "Got it";
            }
        });
        button.dataset.originalLabel = button.textContent;
    });
}

async function loadDailyInsights() {
    const list = document.getElementById("dailyInsightsList");
    const meta = document.getElementById("dailyInsightsMeta");
    if (!list) return;

    try {
        const existingResponse = await fetch(API + "/insights/daily");
        await throwIfNotOk(existingResponse, "Daily insights failed");
        const existingData = await existingResponse.json();
        const existingInsights = existingData.insights || [];
        renderDailyInsights(existingInsights);
    } catch (error) {
        if (isAuthError(error)) {
            handleUnauthorized();
            return;
        }
        list.innerHTML = '<p class="coach-history-empty">Couldn\'t load daily insights right now.</p>';
        if (meta) meta.textContent = "";
    }
}

async function askDashboardCoach() {
    const input = document.getElementById("dashboardCoachInput");
    const button = document.getElementById("dashboardCoachAskBtn");
    const responseEl = document.getElementById("dashboardCoachResponse");
    if (!input || !button || !responseEl) return;

    const question = String(input.value || "").trim();
    if (!question) {
        showToast(t("coach.ask.empty_warning", "Ask Money Coach a question first"));
        return;
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = t("coach.ask.thinking", "Thinking…");
    responseEl.hidden = false;
    responseEl.textContent = t("coach.ask.status_thinking", "Money Coach is thinking…");

    try {
        const response = await fetch(API + "/money-coach", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question })
        });
        await throwIfNotOk(response, t("coach.ask.error", "Money Coach cannot answer right now"));
        const data = await response.json();
        responseEl.innerHTML = formatMoneyCoachAnswer(data.answer || data.response || "");
        input.value = "";
        if (typeof loadMoneyCoachHistory === "function") await loadMoneyCoachHistory();
    } catch (error) {
        if (isAuthError(error)) {
            handleUnauthorized();
            return;
        }
        handleFetchError(error, t("coach.ask.error", "Money Coach cannot answer right now"));
        responseEl.textContent = t("coach.ask.error", "Money Coach cannot answer right now");
    } finally {
        button.disabled = false;
        button.textContent = originalLabel || t("coach.ask.send", "Ask Money Coach");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const moneyCoachInput = document.getElementById("moneyCoachInput");
    const moneyCoachAskBtn = document.getElementById("moneyCoachAskBtn");
    const moneyCoachResponseCard = document.getElementById("moneyCoachResponseCard");
    const moneyCoachResponseText = document.getElementById("moneyCoachResponseText");
    const moneyCoachStatus = document.getElementById("moneyCoachStatus");

    const coachStatusPill = document.getElementById("coachStatusPill");
    const coachStatusPillLabel = coachStatusPill ? coachStatusPill.querySelector("span:last-child") : null;
    const coachStatusDot = coachStatusPill ? coachStatusPill.querySelector(".coach-status-dot") : null;
    const setCoachStatus = (state) => {
        if (!coachStatusPill) return;
        const isThinking = state === "thinking";
        const isStreaming = state === "streaming";
        const isActive = isThinking || isStreaming;
        coachStatusPill.classList.toggle("coach-status-thinking", isActive);
        coachStatusPill.classList.toggle("coach-status-ready", !isActive);
        if (coachStatusDot) {
            coachStatusDot.classList.toggle("coach-status-dot-typing", isActive);
            if (isActive && coachStatusDot.childElementCount === 0) {
                coachStatusDot.innerHTML = '<span></span><span></span><span></span>';
            } else if (!isActive && coachStatusDot.childElementCount > 0) {
                coachStatusDot.innerHTML = '';
            }
        }
        if (coachStatusPillLabel) {
            coachStatusPillLabel.textContent = isStreaming
                ? t("coach.ask.status_streaming", "Coach is typing…")
                : isThinking
                    ? t("coach.ask.status_thinking", "Coach is thinking…")
                    : t("coach.ask.status_ready", "Coach is ready");
        }
    };

    document.querySelectorAll(".coach-starter-card").forEach(card => {
        card.addEventListener("click", () => {
            if (moneyCoachInput) {
                moneyCoachInput.value = card.textContent.trim();
                moneyCoachInput.dispatchEvent(new Event("input"));
                moneyCoachInput.focus();
            }
        });
    });

    if (moneyCoachAskBtn) {
        const sendLabelEl = moneyCoachAskBtn.querySelector("span");
        const defaultSendLabel = () => t("coach.ask.send", "Ask Money Coach");
        const thinkingSendLabel = () => t("coach.ask.thinking", "Thinking…");

        moneyCoachAskBtn.addEventListener("click", async () => {
            const question = moneyCoachInput ? moneyCoachInput.value.trim() : "";

            if (!question) {
                showToast(t("coach.ask.empty_warning", "Ask Money Coach a question first"));
                return;
            }

            moneyCoachAskBtn.disabled = true;
            if (sendLabelEl) sendLabelEl.textContent = thinkingSendLabel();
            else moneyCoachAskBtn.textContent = thinkingSendLabel();
            setCoachStatus("thinking");

            const skeleton = document.getElementById("moneyCoachSkeleton");
            if (skeleton) skeleton.style.display = "block";
            if (moneyCoachResponseCard) moneyCoachResponseCard.style.display = "none";
            if (moneyCoachResponseText) moneyCoachResponseText.innerHTML = "";
            renderMoneyCoachDataUsed(null);
            renderMoneyCoachFeedback("");

            if (moneyCoachStatus) {
                moneyCoachStatus.textContent = t("coach.ask.status_thinking", "Coach is thinking…");
            }

            let accumulatedAnswer = "";
            let finalMode = "ai";
            let firstDeltaReceived = false;

            const renderProgressive = (final = false) => {
                if (!moneyCoachResponseText) return;
                const formatted = formatMoneyCoachAnswer(accumulatedAnswer);
                moneyCoachResponseText.innerHTML = final
                    ? formatted
                    : `${formatted}<span class="coach-typing-cursor">▌</span>`;
            };

            try {
                const response = await fetch(API + "/money-coach/stream", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "text/event-stream"
                    },
                    body: JSON.stringify({ question })
                });
                await throwIfNotOk(response, t("coach.ask.failed", "Money Coach failed"));

                if (!response.body || !response.body.getReader) {
                    // Browser without streaming support — fall back to single-shot.
                    const data = await response.json();
                    accumulatedAnswer = data.answer || "";
                    finalMode = data.mode || "ai";
                    const sk = document.getElementById("moneyCoachSkeleton");
                    if (sk) sk.style.display = "none";
                    if (moneyCoachResponseCard) moneyCoachResponseCard.style.display = "block";
                    renderProgressive(true);
                    currentMoneyCoachHistoryId = data.history_id || null;
                    renderMoneyCoachDataUsed(data.data_used);
                } else {
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = "";
                    let doneEventReceived = false;

                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        let boundary = buffer.indexOf("\n\n");
                        while (boundary !== -1) {
                            const rawEvent = buffer.slice(0, boundary);
                            buffer = buffer.slice(boundary + 2);
                            boundary = buffer.indexOf("\n\n");

                            const line = rawEvent.split("\n").find(l => l.startsWith("data:"));
                            if (!line) continue;
                            const payload = line.slice(5).trim();
                            if (!payload) continue;

                            let evt;
                            try { evt = JSON.parse(payload); }
                            catch (e) { continue; }

                            if (evt.type === "ready") {
                                setCoachStatus("thinking");
                            } else if (evt.type === "delta") {
                                if (!firstDeltaReceived) {
                                    firstDeltaReceived = true;
                                    setCoachStatus("streaming");
                                    const sk = document.getElementById("moneyCoachSkeleton");
                                    if (sk) sk.style.display = "none";
                                    if (moneyCoachResponseCard) moneyCoachResponseCard.style.display = "block";
                                }
                                accumulatedAnswer += evt.text || "";
                                renderProgressive(false);
                            } else if (evt.type === "fallback") {
                                accumulatedAnswer = evt.answer || "";
                                finalMode = "fallback";
                                if (!firstDeltaReceived) {
                                    firstDeltaReceived = true;
                                    const sk = document.getElementById("moneyCoachSkeleton");
                                    if (sk) sk.style.display = "none";
                                    if (moneyCoachResponseCard) moneyCoachResponseCard.style.display = "block";
                                }
                                renderProgressive(false);
                            } else if (evt.type === "done") {
                                doneEventReceived = true;
                                finalMode = evt.mode || finalMode;
                                currentMoneyCoachHistoryId = evt.history_id || null;
                                renderMoneyCoachDataUsed(evt.data_used);
                            } else if (evt.type === "error") {
                                throw new Error(evt.message || t("coach.ask.error", "Money Coach could not answer right now"));
                            }
                        }
                    }

                    renderProgressive(true);

                    if (!doneEventReceived && !accumulatedAnswer) {
                        throw new Error(t("coach.ask.error", "Money Coach could not answer right now"));
                    }
                }

                if (moneyCoachStatus) {
                    moneyCoachStatus.textContent = finalMode === "fallback"
                        ? t("coach.ask.status_local", "Local guidance")
                        : t("coach.ask.status_ready", "Coach is ready");
                }

                await loadMoneyCoachHistory();
                await loadMoneyCoachInsights();
                await loadMoneyCoachSafeToSpend();
            } catch (error) {
                console.error("Money Coach error:", error);
                handleFetchError(error, t("coach.ask.error", "Money Coach could not answer right now"));

                if (moneyCoachResponseText && !accumulatedAnswer) {
                    moneyCoachResponseText.innerHTML = "";
                }
                if (moneyCoachStatus) {
                    moneyCoachStatus.textContent = t("coach.ask.status_retry", "Try again");
                }
            } finally {
                moneyCoachAskBtn.disabled = false;
                if (sendLabelEl) sendLabelEl.textContent = defaultSendLabel();
                else moneyCoachAskBtn.textContent = defaultSendLabel();
                setCoachStatus("ready");
                const sk = document.getElementById("moneyCoachSkeleton");
                if (sk) sk.style.display = "none";
            }
        });
    }

    document.querySelectorAll(".coach-feedback-btn").forEach(button => {
        button.addEventListener("click", async () => {
            if (!currentMoneyCoachHistoryId) {
                showToast("Ask Money Coach first");
                return;
            }

            const feedback = button.dataset.feedback;
            if (!feedback) return;

            button.disabled = true;

            try {
                const response = await fetch(API + `/money-coach/history/${currentMoneyCoachHistoryId}/feedback`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ feedback })
                });
                await throwIfNotOk(response, "Could not save feedback");
                renderMoneyCoachFeedback(feedback);
                await loadMoneyCoachHistory();
                showToast(feedback === "helpful" ? "Thanks, feedback saved" : "Thanks, this helps improve Money Coach");
            } catch (error) {
                handleFetchError(error, "Could not save feedback");
            } finally {
                button.disabled = false;
            }
        });
    });

    loadMoneyCoachHistory();
    loadMoneyCoachInsights();
    loadMoneyCoachSafeToSpend();
});

document.addEventListener("DOMContentLoaded", () => {
    const dashboardCoachAskBtn = document.getElementById("dashboardCoachAskBtn");
    const dashboardCoachInput = document.getElementById("dashboardCoachInput");

    if (dashboardCoachAskBtn) {
        dashboardCoachAskBtn.addEventListener("click", askDashboardCoach);
    }

    if (dashboardCoachInput) {
        dashboardCoachInput.addEventListener("keydown", (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                askDashboardCoach();
            }
        });
    }
});

// ==============================
// ADD RECURRING PAYMENT MODAL
// ==============================
const recurringModal = document.getElementById("recurringModal");
const addRecurringBtn = document.getElementById("addRecurringBtn");
const recurringModalClose = document.getElementById("recurringModalClose");
const recurringModalCancel = document.getElementById("recurringModalCancel");
const recurringForm = document.getElementById("recurringForm");
const deleteRecurringModal = document.getElementById("deleteRecurringModal");
const deleteRecurringModalClose = document.getElementById("deleteRecurringModalClose");
const deleteRecurringCancel = document.getElementById("deleteRecurringCancel");
const deleteRecurringConfirm = document.getElementById("deleteRecurringConfirm");
const deleteRecurringIdInput = document.getElementById("deleteRecurringId");

const recurringTypeInput = document.getElementById("recurringType");
const recurringTypeExpenseBtn = document.getElementById("recurringTypeExpenseBtn");
const recurringTypeIncomeBtn = document.getElementById("recurringTypeIncomeBtn");
let recurringSaveInProgress = false;

function setRecurringType(type = "expense") {
    const normalized = type === "income" ? "income" : "expense";

    if (recurringTypeInput) recurringTypeInput.value = normalized;

    if (recurringTypeExpenseBtn) {
        recurringTypeExpenseBtn.classList.toggle("active", normalized === "expense");
    }

    if (recurringTypeIncomeBtn) {
        recurringTypeIncomeBtn.classList.toggle("active", normalized === "income");
    }
}

function getRecurringModalRefs() {
    return {
        modal: document.getElementById("recurringModal"),
        form: document.getElementById("recurringForm"),
        idInput: document.getElementById("recurringId"),
        title: document.getElementById("recurringModalTitle"),
        desc: document.getElementById("recurringModalDesc"),
        submitBtn: document.getElementById("recurringSubmitBtn"),
        nextDateInput: document.getElementById("recurringNextDate")
    };
}

function openRecurringModal(recurring = null) {
    const { modal, form, idInput, title, desc, submitBtn, nextDateInput } = getRecurringModalRefs();
    if (!modal) return;

    if (form) form.reset();

    const nameInput = document.getElementById("recurringName");
    const amountInput = document.getElementById("recurringAmount");
    const accountInput = document.getElementById("recurringAccount");
    const frequencyInput = document.getElementById("recurringFrequency");

    if (recurring) {
        const amount = parseFloat(recurring.amount || 0);
        const categoryName = recurring.category || "";
        const categoryIcon = getCategoryIcon(categoryName);

        if (idInput) idInput.value = recurring.id || "";
        if (title) title.textContent = t("recurring.modal.edit_title", "Edit Recurring Payment");
        if (desc) desc.textContent = t("recurring.modal.edit_desc", "Update this recurring payment and keep your forecast accurate.");
        if (submitBtn) submitBtn.textContent = t("recurring.modal.update", "Save Changes");
        if (nameInput) nameInput.value = recurring.name || "";
        if (amountInput) amountInput.value = Math.abs(amount) || "";
        if (accountInput) accountInput.value = recurring.account || "Recurring";
        if (frequencyInput) frequencyInput.value = recurring.frequency || "monthly";
        if (nextDateInput) nextDateInput.value = dateInputValue(recurring.next_date) || new Date().toISOString().split("T")[0];

        setRecurringType(amount > 0 ? "income" : "expense");
        setSelectedRecurringCategory(categoryName, categoryIcon);
    } else {
        if (idInput) idInput.value = "";
        if (title) title.textContent = t("recurring.modal.add_title", "Add Recurring Payment");
        if (desc) desc.textContent = t("recurring.modal.desc", "Add a new recurring income or bill to your forecast.");
        if (submitBtn) submitBtn.textContent = t("recurring.modal.save", "Save Recurring");
        if (accountInput) accountInput.value = "Recurring";

        setRecurringType("expense");
        setSelectedRecurringCategory("", "🏷️");

        if (nextDateInput) {
            nextDateInput.value = new Date().toISOString().split("T")[0];
        }
    }

    modal.style.display = "flex";
}

function closeRecurringModal() {
    const { modal, form, idInput, title, desc, submitBtn } = getRecurringModalRefs();
    if (!modal) return;
    modal.style.display = "none";

    if (form) form.reset();
    if (idInput) idInput.value = "";
    if (title) title.textContent = t("recurring.modal.add_title", "Add Recurring Payment");
    if (desc) desc.textContent = t("recurring.modal.desc", "Add a new recurring income or bill to your forecast.");
    if (submitBtn) submitBtn.textContent = t("recurring.modal.save", "Save Recurring");
    setRecurringType("expense");
    setSelectedRecurringCategory("", "🏷️");
}

function openDeleteRecurringModal(recurringId) {
    if (!deleteRecurringModal || !deleteRecurringIdInput) return;
    deleteRecurringIdInput.value = recurringId || "";
    deleteRecurringModal.style.display = "flex";
}

function closeDeleteRecurringModal() {
    if (!deleteRecurringModal || !deleteRecurringIdInput) return;
    deleteRecurringModal.style.display = "none";
    deleteRecurringIdInput.value = "";
}

window.openRecurringModal = openRecurringModal;
window.closeRecurringModal = closeRecurringModal;

document.addEventListener("click", (e) => {
    if (!(e.target instanceof Element)) return;

    const addBtn = e.target.closest("#addRecurringBtn");
    const closeBtn = e.target.closest("#recurringModalClose");
    const cancelBtn = e.target.closest("#recurringModalCancel");
    const modalBackdrop = e.target.id === "recurringModal" ? e.target : null;
    const deleteModalBackdrop = e.target.id === "deleteRecurringModal" ? e.target : null;

    if (addBtn) {
        e.preventDefault();
        openRecurringModal();
        return;
    }

    if (closeBtn || cancelBtn || modalBackdrop) {
        e.preventDefault();
        closeRecurringModal();
        return;
    }

    if (deleteModalBackdrop) {
        e.preventDefault();
        closeDeleteRecurringModal();
    }
});

if (addRecurringBtn) {
    addRecurringBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openRecurringModal();
    });
}

if (recurringTypeExpenseBtn) {
    recurringTypeExpenseBtn.addEventListener("click", () => setRecurringType("expense"));
}

if (recurringTypeIncomeBtn) {
    recurringTypeIncomeBtn.addEventListener("click", () => setRecurringType("income"));
}

if (deleteRecurringModalClose) {
    deleteRecurringModalClose.addEventListener("click", closeDeleteRecurringModal);
}

if (deleteRecurringCancel) {
    deleteRecurringCancel.addEventListener("click", closeDeleteRecurringModal);
}

if (deleteRecurringConfirm) {
    deleteRecurringConfirm.addEventListener("click", async () => {
        const recurringId = deleteRecurringIdInput ? deleteRecurringIdInput.value : "";
        if (!recurringId) return;

        try {
            const response = await fetch(API + `/recurring/${recurringId}`, {
                method: "DELETE"
            });

            await throwIfNotOk(response, "Failed to delete recurring payment");

            closeDeleteRecurringModal();
            await loadRecurringPayments();
            showToast("Recurring payment deleted");
        } catch (error) {
            console.error("Recurring delete error:", error);
            handleFetchError(error, "Could not delete recurring payment");
        }
    });
}

if (recurringForm) {
    recurringForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (recurringSaveInProgress) return;

        const recurringId = document.getElementById("recurringId").value.trim();
        const name = document.getElementById("recurringName").value.trim();
        const rawAmount = parseFloat(document.getElementById("recurringAmount").value);
        const type = document.getElementById("recurringType").value;
        const category = document.getElementById("recurringCategory").value.trim();
        const account = document.getElementById("recurringAccount").value.trim() || "Recurring";
        const frequency = document.getElementById("recurringFrequency").value;
        const next_date = document.getElementById("recurringNextDate").value;

        if (!name || Number.isNaN(rawAmount) || rawAmount <= 0 || !category || !next_date) {
            showToast("Please fill in all recurring fields correctly");
            return;
        }

        const amount = type === "income" ? Math.abs(rawAmount) : -Math.abs(rawAmount);
        const submitBtn = recurringForm.querySelector('button[type="submit"]');
        const isEditing = !!recurringId;

        try {
            recurringSaveInProgress = true;

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Saving...";
            }

            const response = await fetch(isEditing ? API + `/recurring/${recurringId}` : API + "/recurring", {
                method: isEditing ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    amount,
                    type,
                    category,
                    account,
                    frequency,
                    next_date
                })
            });

            await throwIfNotOk(response, "Failed to save recurring payment");

            closeRecurringModal();
            await loadRecurringPayments();
            showToast(
                isEditing
                    ? "Recurring payment updated"
                    : response.status === 200
                        ? "Recurring payment already exists"
                        : "Recurring payment added"
            );
        } catch (error) {
            console.error("Error adding recurring payment:", error);
            handleFetchError(error, isEditing ? "Could not update recurring payment" : "Could not add recurring payment");
        } finally {
            recurringSaveInProgress = false;

            if (submitBtn) {
                submitBtn.disabled = false;
                const idInput = document.getElementById("recurringId");
                const isEdit = !!(idInput && idInput.value);
                submitBtn.textContent = isEdit
                    ? t("recurring.modal.update", "Save Changes")
                    : t("recurring.modal.save", "Save Recurring");
            }
        }
    });
}

// ══════════════════════════════════════
//  RECEIPT SCAN
// ══════════════════════════════════════

const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;
const RECEIPT_OK_TYPES = new Set([
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"
]);
const RECEIPT_SCAN_HISTORY_KEY = "fintrack.receiptScans.v1";

let scanCurrentFile = null;
let scanCurrentPreviewUrl = null;
let scanCurrentExtracted = null;
let scanCurrentReceiptHash = null;

function receiptHistoryDateLabel(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "before";
    return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function getReceiptScanHistory() {
    try {
        const parsed = JSON.parse(localStorage.getItem(RECEIPT_SCAN_HISTORY_KEY) || "{}");
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
        return {};
    }
}

function setReceiptScanHistory(history) {
    try {
        const entries = Object.entries(history || {})
            .sort((a, b) => String(b[1]?.scannedAt || "").localeCompare(String(a[1]?.scannedAt || "")))
            .slice(0, 120);
        localStorage.setItem(RECEIPT_SCAN_HISTORY_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch (e) {}
}

async function hashReceiptFile(file) {
    if (!window.crypto?.subtle || !file?.arrayBuffer) return "";
    const buffer = await file.arrayBuffer();
    const digest = await window.crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function ensureReceiptDuplicateModal() {
    let modal = document.getElementById("receiptDuplicateModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "receiptDuplicateModal";
    modal.className = "receipt-duplicate-modal";
    modal.innerHTML = `
        <div class="receipt-duplicate-panel" role="dialog" aria-modal="true" aria-labelledby="receiptDuplicateTitle">
            <div class="receipt-duplicate-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 3h6l4 4v14H5V3h4z"></path>
                    <path d="M14 3v5h5"></path>
                    <path d="M8 13h8"></path>
                    <path d="M8 17h6"></path>
                </svg>
            </div>
            <div class="receipt-duplicate-copy">
                <h3 id="receiptDuplicateTitle"></h3>
                <p id="receiptDuplicateBody"></p>
            </div>
            <div class="receipt-duplicate-actions">
                <button type="button" class="btn-secondary" data-receipt-duplicate-cancel></button>
                <button type="button" class="btn-primary" data-receipt-duplicate-confirm></button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function showReceiptDuplicateModal(dateLabel) {
    const modal = ensureReceiptDuplicateModal();
    const title = modal.querySelector("#receiptDuplicateTitle");
    const body = modal.querySelector("#receiptDuplicateBody");
    const cancelBtn = modal.querySelector("[data-receipt-duplicate-cancel]");
    const confirmBtn = modal.querySelector("[data-receipt-duplicate-confirm]");

    if (title) title.textContent = t("receipt.duplicate.title", "Receipt already scanned");
    if (body) {
        body.textContent = t(
            "receipt.duplicate.body",
            "This receipt was already scanned on {date}. You can choose another photo or scan it again."
        ).replace("{date}", dateLabel);
    }
    if (cancelBtn) cancelBtn.textContent = t("receipt.duplicate.cancel", "Choose another photo");
    if (confirmBtn) confirmBtn.textContent = t("receipt.duplicate.continue", "Scan again");

    modal.classList.add("is-open");

    return new Promise(resolve => {
        const cleanup = (result) => {
            modal.classList.remove("is-open");
            cancelBtn?.removeEventListener("click", onCancel);
            confirmBtn?.removeEventListener("click", onConfirm);
            modal.removeEventListener("click", onBackdrop);
            document.removeEventListener("keydown", onKeydown);
            resolve(result);
        };
        const onCancel = () => cleanup(false);
        const onConfirm = () => cleanup(true);
        const onBackdrop = (event) => {
            if (event.target === modal) cleanup(false);
        };
        const onKeydown = (event) => {
            if (event.key === "Escape") cleanup(false);
        };

        cancelBtn?.addEventListener("click", onCancel);
        confirmBtn?.addEventListener("click", onConfirm);
        modal.addEventListener("click", onBackdrop);
        document.addEventListener("keydown", onKeydown);
        setTimeout(() => confirmBtn?.focus(), 0);
    });
}

async function confirmDuplicateReceiptScan(receiptHash) {
    if (!receiptHash) return true;
    const history = getReceiptScanHistory();
    const previous = history[receiptHash];
    if (!previous) return true;

    const dateLabel = receiptHistoryDateLabel(previous.scannedAt);
    return showReceiptDuplicateModal(dateLabel);
}

function rememberReceiptScan(receiptHash, extracted = {}) {
    if (!receiptHash) return;
    const history = getReceiptScanHistory();
    history[receiptHash] = {
        scannedAt: new Date().toISOString(),
        merchant: String(extracted.merchant || "").slice(0, 120),
        amount: Number(extracted.amount || 0) || 0,
        date: String(extracted.date || "").slice(0, 20),
    };
    setReceiptScanHistory(history);
}

function closeReceiptImageLightbox() {
    const lightbox = document.getElementById("receiptImageLightbox");
    const img = document.getElementById("receiptImageLightboxImg");
    if (img) img.src = "";
    if (lightbox) lightbox.style.display = "none";
}

function openReceiptImageLightbox() {
    if (!scanCurrentPreviewUrl) return;
    const lightbox = document.getElementById("receiptImageLightbox");
    const img = document.getElementById("receiptImageLightboxImg");
    if (!lightbox || !img) return;
    img.src = scanCurrentPreviewUrl;
    lightbox.style.display = "flex";
}

function scanReceiptShowStep(step) {
    ["pick", "scan", "review", "error"].forEach(name => {
        const el = document.getElementById(`scanStep${name.charAt(0).toUpperCase() + name.slice(1)}`);
        if (el) el.hidden = (name !== step);
    });
    const saveBtn   = document.getElementById("scanReceiptSave");
    const retryBtn  = document.getElementById("scanReceiptRetry");
    const manualBtn = document.getElementById("scanReceiptManual");
    if (saveBtn)   saveBtn.hidden   = (step !== "review");
    if (retryBtn)  retryBtn.hidden  = (step !== "review" && step !== "error");
    if (manualBtn) manualBtn.hidden = (step !== "error");
}

function scanReceiptResetState() {
    closeReceiptImageLightbox();
    if (scanCurrentPreviewUrl) {
        try { URL.revokeObjectURL(scanCurrentPreviewUrl); } catch (e) {}
    }
    scanCurrentFile = null;
    scanCurrentPreviewUrl = null;
    scanCurrentExtracted = null;
    scanCurrentReceiptHash = null;

    const fileInput = document.getElementById("scanReceiptFileInput");
    if (fileInput) fileInput.value = "";

    const previewImg = document.getElementById("scanPreviewImg");
    const reviewImg  = document.getElementById("scanReviewImg");
    if (previewImg) previewImg.src = "";
    if (reviewImg) reviewImg.src = "";

    const form = document.getElementById("scanReceiptForm");
    if (form) form.reset();

    scanReceiptShowStep("pick");
}

function openScanReceiptModal() {
    const modal = document.getElementById("scanReceiptModal");
    if (!modal) return;
    scanReceiptResetState();
    modal.style.display = "flex";
}

function closeScanReceiptModal() {
    const modal = document.getElementById("scanReceiptModal");
    if (!modal) return;
    modal.style.display = "none";
    scanReceiptResetState();
}

function setScanReceiptType(typeValue) {
    const hidden = document.getElementById("scanFieldType");
    if (hidden) hidden.value = typeValue;
    document.querySelectorAll("#scanTypeToggle .premium-type-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.type === typeValue);
    });
}

function showScanReceiptError(message) {
    scanReceiptShowStep("error");
    const msgEl = document.getElementById("scanErrorMsg");
    if (msgEl && message) msgEl.textContent = message;
}

function todayDateInputValue() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function populateScanReceiptReview(extracted, warning) {
    scanCurrentExtracted = extracted || {};
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const suggestedCategory = extracted.suggested_category || extracted.category || "Other";
    const receiptCurrency = sanitizeCurrencyCode(extracted.currency || CURRENT_CURRENCY) || CURRENT_CURRENCY || "USD";

    setVal("scanFieldMerchant", String(extracted.merchant || "").trim());
    setVal("scanFieldAmount",   Math.abs(Number(extracted.amount || 0)) || "");
    setVal("scanFieldCurrency", receiptCurrency);
    setVal("scanFieldDate",     extracted.date && /^\d{4}-\d{2}-\d{2}$/.test(extracted.date) ? extracted.date : todayDateInputValue());
    setVal("scanFieldCategory", String(suggestedCategory));
    setVal("scanFieldAccount",  "Cash");

    setScanReceiptType((extracted.type === "income") ? "income" : "expense");

    const confidenceEl = document.getElementById("scanReviewConfidence");
    if (confidenceEl) {
        const conf = ["high", "medium", "low"].includes(String(extracted.confidence || "").toLowerCase())
            ? String(extracted.confidence).toLowerCase()
            : "medium";
        confidenceEl.classList.remove("confidence-high", "confidence-medium", "confidence-low");
        confidenceEl.classList.add(`confidence-${conf}`);
        confidenceEl.textContent =
            conf === "low"    ? t("receipt.confidence.low",    "Low confidence — please double-check") :
            conf === "medium" ? t("receipt.confidence.medium", "Medium confidence") :
                                t("receipt.confidence.high",   "High confidence");
    }

    const warningEl = document.getElementById("scanReviewWarning");
    if (warningEl) {
        const currencyWarning = receiptCurrency !== CURRENT_CURRENCY
            ? `Receipt currency is ${receiptCurrency}; your app is set to ${CURRENT_CURRENCY}. The amount will be saved in your current app currency unless you adjust it.`
            : "";
        const warningText = warning || currencyWarning;
        if (warningText) {
            warningEl.textContent = warningText;
            warningEl.hidden = false;
        } else {
            warningEl.hidden = true;
            warningEl.textContent = "";
        }
    }

    const reviewImg = document.getElementById("scanReviewImg");
    if (reviewImg && scanCurrentPreviewUrl) reviewImg.src = scanCurrentPreviewUrl;

    scanReceiptShowStep("review");
}

async function uploadScanReceipt() {
    if (!scanCurrentFile) return;

    scanReceiptShowStep("scan");
    const previewImg = document.getElementById("scanPreviewImg");
    if (previewImg && scanCurrentPreviewUrl) previewImg.src = scanCurrentPreviewUrl;

    const formData = new FormData();
    formData.append("image", scanCurrentFile);
    formData.append("lang", CURRENT_LANG || "en");

    try {
        const response = await fetch(API + "/receipt/scan", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            let errMsg = t("receipt.error.msg", "Try a clearer photo, or enter the details manually.");
            try {
                const data = await response.json();
                if (data && data.error) errMsg = data.error;
            } catch (e) {}
            if (response.status === 401) {
                handleUnauthorized();
                return;
            }
            showScanReceiptError(errMsg);
            return;
        }

        const data = await response.json();
        const extracted = data && (data.extracted || data);
        if (!extracted || !Number.isFinite(Number(extracted.amount)) || Number(extracted.amount) <= 0) {
            showScanReceiptError(t("receipt.error.msg", "Try a clearer photo, or enter the details manually."));
            return;
        }
        rememberReceiptScan(scanCurrentReceiptHash, extracted);
        populateScanReceiptReview(extracted, data.warning || "");
    } catch (error) {
        console.error("Receipt scan error:", error);
        showScanReceiptError(t("receipt.error.network", "Network error. Check your connection and try again."));
    }
}

async function handleScanReceiptFile(file) {
    if (!file) return;

    if (!RECEIPT_OK_TYPES.has(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || "")) {
        showToast(t("receipt.error.type", "Unsupported image type. Use JPG, PNG, WEBP or HEIC."));
        return;
    }
    if (file.size > RECEIPT_MAX_BYTES) {
        showToast(t("receipt.error.too_big", "Image is too large (max 8 MB)."));
        return;
    }

    if (scanCurrentPreviewUrl) {
        try { URL.revokeObjectURL(scanCurrentPreviewUrl); } catch (e) {}
    }
    scanCurrentFile = file;
    scanCurrentPreviewUrl = URL.createObjectURL(file);
    scanCurrentReceiptHash = "";

    try {
        scanCurrentReceiptHash = await hashReceiptFile(file);
    } catch (error) {
        console.warn("Receipt hash error:", error);
    }

    if (!(await confirmDuplicateReceiptScan(scanCurrentReceiptHash))) {
        showToast(t("receipt.duplicate.cancelled", "Scan cancelled — this receipt was already scanned."));
        scanReceiptResetState();
        return;
    }

    uploadScanReceipt();
}

async function saveScanReceiptTransaction() {
    const name = String(document.getElementById("scanFieldMerchant")?.value || "").trim();
    const rawAmount = parseFloat(document.getElementById("scanFieldAmount")?.value || "0");
    const currency = sanitizeCurrencyCode(document.getElementById("scanFieldCurrency")?.value || CURRENT_CURRENCY);
    const date = String(document.getElementById("scanFieldDate")?.value || "").trim();
    const category = String(document.getElementById("scanFieldCategory")?.value || "Other").trim();
    const account = String(document.getElementById("scanFieldAccount")?.value || "Cash").trim();
    const type = String(document.getElementById("scanFieldType")?.value || "expense").trim();

    if (!name || !Number.isFinite(rawAmount) || rawAmount <= 0 || !currency || !date) {
        showToast(t("receipt.error.fields", "Please fill in merchant, amount, currency, and date."));
        return;
    }

    const amount = type === "income" ? Math.abs(rawAmount) : -Math.abs(rawAmount);

    const saveBtn = document.getElementById("scanReceiptSave");
    const originalLabel = saveBtn ? saveBtn.textContent : "";
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = t("receipt.saving", "Saving…");
    }

    try {
        const response = await fetch(API + "/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, amount, category, account, date, source: "receipt_scan" })
        });
        await throwIfNotOk(response, t("receipt.error.save", "Could not save transaction"));
        showToast(t("receipt.toast_saved", "Transaction saved from receipt"));
        closeScanReceiptModal();
        if (typeof loadTransactions === "function") await loadTransactions();
        if (typeof loadDashboard === "function") await loadDashboard();
    } catch (error) {
        handleFetchError(error, t("receipt.error.save", "Could not save transaction"));
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalLabel || t("receipt.save", "Save transaction");
        }
        return;
    }

    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalLabel || t("receipt.save", "Save transaction");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const fabBtn    = document.getElementById("scanReceiptFab");
    const modal     = document.getElementById("scanReceiptModal");
    const closeBtn  = document.getElementById("scanReceiptModalClose");
    const cancelBtn = document.getElementById("scanReceiptCancel");
    const retryBtn  = document.getElementById("scanReceiptRetry");
    const manualBtn = document.getElementById("scanReceiptManual");
    const saveBtn   = document.getElementById("scanReceiptSave");
    const dropzone  = document.getElementById("scanDropzone");
    const fileInput = document.getElementById("scanReceiptFileInput");
    const reviewImageBtn = document.getElementById("scanReviewImageBtn");
    const lightbox = document.getElementById("receiptImageLightbox");
    const lightboxClose = document.getElementById("receiptImageLightboxClose");

    if (!modal || !fileInput || !dropzone) return;

    if (fabBtn) fabBtn.addEventListener("click", openScanReceiptModal);
    if (closeBtn) closeBtn.addEventListener("click", closeScanReceiptModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeScanReceiptModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeScanReceiptModal(); });

    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        if (file) handleScanReceiptFile(file);
    });

    ["dragover", "dragenter"].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropzone.classList.add("is-dragover");
        });
    });
    ["dragleave", "drop"].forEach(evt => {
        dropzone.addEventListener(evt, () => dropzone.classList.remove("is-dragover"));
    });
    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        if (file) handleScanReceiptFile(file);
    });

    document.querySelectorAll("#scanTypeToggle .premium-type-btn").forEach(btn => {
        btn.addEventListener("click", () => setScanReceiptType(btn.dataset.type));
    });

    if (retryBtn) retryBtn.addEventListener("click", () => {
        scanReceiptResetState();
        fileInput.click();
    });

    if (manualBtn) manualBtn.addEventListener("click", () => {
        closeScanReceiptModal();
        const addBtn = document.getElementById("addTransactionBtn");
        if (addBtn) addBtn.click();
    });

    if (saveBtn) saveBtn.addEventListener("click", saveScanReceiptTransaction);
    if (reviewImageBtn) reviewImageBtn.addEventListener("click", openReceiptImageLightbox);
    if (lightboxClose) lightboxClose.addEventListener("click", closeReceiptImageLightbox);
    if (lightbox) {
        lightbox.addEventListener("click", (e) => {
            if (e.target === lightbox) closeReceiptImageLightbox();
        });
    }
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeReceiptImageLightbox();
    });
});

// ══════════════════════════════════════
//  CASH FLOW FORECAST + WHAT-IF
// ══════════════════════════════════════

let cashflowLatest = null;

function cashflowFmt(value, currency) {
    const sign = value < 0 ? "-" : "";
    return `${sign}${currency} ${Math.abs(Number(value || 0)).toFixed(2)}`;
}

function cashflowShortDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const locale = CURRENT_LANG === "fr" ? "fr-FR" : CURRENT_LANG === "es" ? "es-ES" : "en-US";
    return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function buildCashflowPath(daily, width, height, minY, maxY) {
    if (!daily || daily.length === 0) return { line: "", area: "" };
    const span = Math.max(maxY - minY, 1);
    const stepX = width / Math.max(daily.length - 1, 1);
    const points = daily.map((d, i) => {
        const x = i * stepX;
        const y = height - ((d.balance - minY) / span) * height;
        return [x, y];
    });
    const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
    const area = `${line} L ${width.toFixed(2)} ${height.toFixed(2)} L 0 ${height.toFixed(2)} Z`;
    return { line, area };
}

function renderCashflowForecast(data) {
    const card = document.getElementById("cashflowCard");
    if (!card || !data) return;
    cashflowLatest = data;

    const currency = data.currency || "USD";
    const daily = Array.isArray(data.daily) ? data.daily : [];
    const events = Array.isArray(data.events) ? data.events : [];
    const minBal = Number(data.minimum_balance || 0);
    const endBal = Number(data.end_balance || 0);
    const startBal = Number(data.start_balance || 0);
    const zeroCrossing = data.zero_crossing_date;

    // Headline copy + tone
    const headlineEl = document.getElementById("cashflowHeadline");
    const kickerEl = document.getElementById("cashflowKicker");
    const textEl = document.getElementById("cashflowHeadlineText");

    let tone = "good";
    let kickerText = t("cashflow.kicker.good", "On track");
    let headlineText;

    if (zeroCrossing) {
        tone = "danger";
        kickerText = t("cashflow.kicker.danger", "Heads up");
        headlineText = t("cashflow.headline.zero", "You may run out of cash on {date}.")
            .replace("{date}", cashflowShortDate(zeroCrossing));
    } else if (minBal < 100) {
        tone = "warn";
        kickerText = t("cashflow.kicker.warn", "Tight");
        headlineText = t("cashflow.headline.tight",
            "Your lowest point is {amount} on {date} — keep extra spending light until then.")
            .replace("{amount}", cashflowFmt(minBal, currency))
            .replace("{date}", cashflowShortDate(data.minimum_date));
    } else {
        headlineText = t("cashflow.headline.good", "You'll have about {amount} free in 30 days.")
            .replace("{amount}", cashflowFmt(endBal, currency));
    }

    if (headlineEl) {
        headlineEl.classList.remove("cashflow-headline-warn", "cashflow-headline-danger");
        if (tone === "warn") headlineEl.classList.add("cashflow-headline-warn");
        if (tone === "danger") headlineEl.classList.add("cashflow-headline-danger");
    }
    if (kickerEl) kickerEl.textContent = kickerText;
    if (textEl) textEl.textContent = headlineText;

    card.classList.toggle("has-zero-crossing", !!zeroCrossing);

    // Chart
    const balances = daily.map(d => d.balance);
    const rawMin = Math.min(...balances, 0);
    const rawMax = Math.max(...balances, 0);
    const pad = (rawMax - rawMin) * 0.08 || 1;
    const minY = rawMin - pad;
    const maxY = rawMax + pad;
    const { line, area } = buildCashflowPath(daily, 400, 100, minY, maxY);
    const lineEl = document.getElementById("cashflowLine");
    const areaEl = document.getElementById("cashflowArea");
    if (lineEl) lineEl.setAttribute("d", line);
    if (areaEl) areaEl.setAttribute("d", area);
    // Zero line position
    const zeroEl = document.getElementById("cashflowZero");
    if (zeroEl) {
        const span = Math.max(maxY - minY, 1);
        const zeroY = 100 - ((0 - minY) / span) * 100;
        zeroEl.setAttribute("y1", zeroY.toFixed(2));
        zeroEl.setAttribute("y2", zeroY.toFixed(2));
    }

    // Event dots
    const dotsGroup = document.getElementById("cashflowEventDots");
    if (dotsGroup) {
        const span = Math.max(maxY - minY, 1);
        const stepX = 400 / Math.max(daily.length - 1, 1);
        const byDate = new Map(daily.map((d, i) => [d.date, { x: i * stepX, y: 100 - ((d.balance - minY) / span) * 100 }]));
        dotsGroup.innerHTML = events.slice(0, 12).map(evt => {
            const pos = byDate.get(evt.date);
            if (!pos) return "";
            const cls = evt.type === "income" ? "income" : "expense";
            return `<circle class="cashflow-event-dot ${cls}" cx="${pos.x.toFixed(2)}" cy="${pos.y.toFixed(2)}" r="3"/>`;
        }).join("");
    }

    // Axis labels
    if (daily.length) {
        const startEl = document.getElementById("cashflowAxisStart");
        const endEl = document.getElementById("cashflowAxisEnd");
        if (startEl) startEl.textContent = cashflowShortDate(daily[0].date);
        if (endEl) endEl.textContent = cashflowShortDate(daily[daily.length - 1].date);
    }

    // Stats
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    setText("cashflowStatToday", cashflowFmt(startBal, currency));
    setText("cashflowStatMin",   cashflowFmt(minBal, currency));
    setText("cashflowStatMinDate", cashflowShortDate(data.minimum_date));
    setText("cashflowStatEnd",   cashflowFmt(endBal, currency));

    // Hide the lowest-point tile when it matches the end balance — redundant.
    const minTile = document.getElementById("cashflowStatMin")?.closest(".cashflow-stat");
    const statsWrap = document.querySelector(".cashflow-stats");
    const hideMin = Math.abs(minBal - endBal) < 0.005 && !zeroCrossing;
    if (minTile) minTile.hidden = hideMin;
    if (statsWrap) statsWrap.classList.toggle("cashflow-stats-two", hideMin);

    // Event list (next 4)
    const eventsEl = document.getElementById("cashflowEvents");
    if (eventsEl) {
        const upcoming = events.slice(0, 4);
        eventsEl.innerHTML = upcoming.map(evt => {
            const cls = evt.type === "income" ? "income" : "expense";
            const sign = evt.amount > 0 ? "+" : "";
            const amountText = `${sign}${currency} ${Math.abs(evt.amount).toFixed(2)}`;
            return `
                <div class="cashflow-event">
                    <span class="cashflow-event-date">${escapeHTML(cashflowShortDate(evt.date))}</span>
                    <span class="cashflow-event-label">${escapeHTML(evt.label || "")}</span>
                    <span class="cashflow-event-amount ${cls}">${escapeHTML(amountText)}</span>
                </div>
            `;
        }).join("");
    }
}

let cashflowLoadInFlight = null;

async function loadCashflowForecast() {
    const card = document.getElementById("cashflowCard");
    if (!card) return;
    // De-dupe overlapping calls — multiple bootstrap paths can race.
    if (cashflowLoadInFlight) return cashflowLoadInFlight;
    cashflowLoadInFlight = (async () => {
        try {
            const res = await fetch(API + "/money-coach/cash-flow-forecast?days=30");
            if (res.status === 402) {
                const body = await res.json().catch(() => ({}));
                if (cashflowLatest) return;
                const textEl = document.getElementById("cashflowHeadlineText");
                const kickerEl = document.getElementById("cashflowKicker");
                if (kickerEl) kickerEl.textContent = t("billing.trial_expired_kicker", "Trial ended");
                if (textEl) {
                    textEl.textContent = body.error || t("billing.trial_expired", "Your trial has ended. Subscribe to keep using the forecast.");
                }
                return;
            }
            await throwIfNotOk(res, "Forecast request failed");
            const data = await res.json();
            renderCashflowForecast(data);
        } catch (error) {
            if (isAuthError(error)) { handleUnauthorized(); return; }
            // Don't clobber a working render with an error from a later retry.
            if (cashflowLatest) return;
            const textEl = document.getElementById("cashflowHeadlineText");
            const kickerEl = document.getElementById("cashflowKicker");
            if (textEl) textEl.textContent = t("cashflow.error", "Couldn't load forecast. Try refreshing.");
            if (kickerEl) kickerEl.textContent = "";
        } finally {
            cashflowLoadInFlight = null;
        }
    })();
    return cashflowLoadInFlight;
}

function renderWhatIfResult(data) {
    const wrap = document.getElementById("whatIfResult");
    if (!wrap || !data) return;

    const verdictEl = document.getElementById("whatIfVerdict");
    const labelEl = document.getElementById("whatIfVerdictLabel");
    const reasonEl = document.getElementById("whatIfReason");
    const endEl = document.getElementById("whatIfImpactEnd");
    const endDelta = document.getElementById("whatIfImpactEndDelta");
    const minEl = document.getElementById("whatIfImpactMin");
    const minDelta = document.getElementById("whatIfImpactMinDelta");

    const currency = data.currency || "USD";
    const verdict = data.verdict || "yes";

    if (verdictEl) {
        verdictEl.classList.remove("whatif-verdict-yes", "whatif-verdict-wait", "whatif-verdict-no");
        verdictEl.classList.add(`whatif-verdict-${verdict}`);
    }
    if (labelEl) labelEl.textContent = t(`whatif.verdict.${verdict}`,
        verdict === "yes" ? "Yes, you can" : verdict === "wait" ? "Wait" : "Not yet");

    const sim = data.simulated || {};
    const base = data.base || {};
    const simEnd = Number(sim.end_balance || 0);
    const simMin = Number(sim.minimum_balance || 0);

    let reason;
    if (verdict === "no") {
        reason = t("whatif.reason.no", "This pushes your balance into the red around {date}.")
            .replace("{date}", cashflowShortDate(sim.zero_crossing_date || sim.minimum_date));
    } else if (verdict === "wait") {
        reason = t("whatif.reason.wait", "You'd be left with about {min} at the lowest point. Wait until after a paycheck for a comfortable margin.")
            .replace("{min}", cashflowFmt(simMin, currency));
    } else {
        reason = t("whatif.reason.yes", "After this purchase you'd still have about {end} at the end of the month.")
            .replace("{end}", cashflowFmt(simEnd, currency));
    }
    if (reasonEl) reasonEl.textContent = reason;

    const fmtDelta = (deltaNum) => {
        if (!Number.isFinite(deltaNum)) return "";
        const sign = deltaNum >= 0 ? "+" : "−";
        return `${sign}${currency} ${Math.abs(deltaNum).toFixed(2)}`;
    };
    const setDelta = (el, value) => {
        if (!el) return;
        el.textContent = fmtDelta(value);
        el.classList.remove("delta-up", "delta-down");
        if (value > 0) el.classList.add("delta-up");
        if (value < 0) el.classList.add("delta-down");
    };

    if (endEl) endEl.textContent = cashflowFmt(simEnd, currency);
    if (minEl) minEl.textContent = cashflowFmt(simMin, currency);
    const deltas = data.deltas || {};
    setDelta(endDelta, Number(deltas.end_balance || 0));
    setDelta(minDelta, Number(deltas.minimum_balance || 0));

    wrap.hidden = false;
}

function openWhatIfModal() {
    const modal = document.getElementById("whatIfModal");
    if (!modal) return;
    const form = document.getElementById("whatIfForm");
    const result = document.getElementById("whatIfResult");
    if (form) form.reset();
    if (result) result.hidden = true;
    const whenInput = document.getElementById("whatIfWhen");
    if (whenInput) {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        whenInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    modal.style.display = "flex";
}

function closeWhatIfModal() {
    const modal = document.getElementById("whatIfModal");
    if (!modal) return;
    modal.style.display = "none";
}

async function runWhatIfSimulation() {
    const amountVal = parseFloat(document.getElementById("whatIfAmount")?.value || "0");
    if (!Number.isFinite(amountVal) || amountVal <= 0) {
        showToast(t("whatif.error.amount", "Enter an amount to simulate."));
        return;
    }
    const payload = {
        amount: amountVal,
        label: (document.getElementById("whatIfLabel")?.value || "").trim(),
        when: (document.getElementById("whatIfWhen")?.value || "").trim() || undefined,
        category: (document.getElementById("whatIfCategory")?.value || "").trim(),
    };

    const runBtn = document.getElementById("whatIfRun");
    const originalLabel = runBtn ? runBtn.textContent : "";
    if (runBtn) {
        runBtn.disabled = true;
        runBtn.textContent = t("whatif.simulating", "Simulating…");
    }

    try {
        const res = await fetch(API + "/money-coach/what-if", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        await throwIfNotOk(res, t("whatif.error.failed", "Could not run simulation"));
        const data = await res.json();
        renderWhatIfResult(data);
    } catch (error) {
        handleFetchError(error, t("whatif.error.failed", "Could not run simulation"));
    } finally {
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.textContent = originalLabel || t("whatif.run", "See impact");
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const card = document.getElementById("cashflowCard");
    if (card) loadCashflowForecast();

    const openBtn = document.getElementById("cashflowWhatIfBtn");
    const modal = document.getElementById("whatIfModal");
    const closeBtn = document.getElementById("whatIfModalClose");
    const cancelBtn = document.getElementById("whatIfCancel");
    const runBtn = document.getElementById("whatIfRun");

    if (openBtn) openBtn.addEventListener("click", openWhatIfModal);
    if (closeBtn) closeBtn.addEventListener("click", closeWhatIfModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeWhatIfModal);
    if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeWhatIfModal(); });
    if (runBtn) runBtn.addEventListener("click", runWhatIfSimulation);
});

// ──────────────────────────────────────────────────────────────────────────
//  Onboarding modal (4 steps on first login)
// ──────────────────────────────────────────────────────────────────────────
(function setupOnboardingModal() {
    let initialized = false;
    let activeStep = 1;
    const TOTAL_STEPS = 4;
    const state = {
        goal: null,
        currency: "",
        language: "en",
        account_nickname: "",
        starting_balance: "",
        first_action: null,
    };
    let saving = false;
    let postSubmitAction = null;

    // Map of likely browser locales → default currency. Keep the list short
    // and confident; everything else falls through to USD.
    const LOCALE_TO_CURRENCY = {
        "en-CA": "CAD", "fr-CA": "CAD",
        "en-US": "USD",
        "fr-FR": "EUR", "es-ES": "EUR", "de-DE": "EUR", "it-IT": "EUR", "pt-PT": "EUR",
        "en-GB": "GBP",
        "en-AU": "AUD",
        "ja-JP": "JPY",
        "zh-CN": "CNY", "zh-HK": "HKD", "zh-TW": "TWD",
        "ko-KR": "KRW",
        "es-MX": "MXN",
        "pt-BR": "BRL",
        "es-AR": "ARS",
        "en-IN": "INR", "hi-IN": "INR",
        "es-CL": "CLP", "es-CO": "COP",
    };

    function detectBrowserCurrency() {
        try {
            const tag = (navigator.language || "").trim();
            if (LOCALE_TO_CURRENCY[tag]) return LOCALE_TO_CURRENCY[tag];
            for (const lang of navigator.languages || []) {
                if (LOCALE_TO_CURRENCY[lang]) return LOCALE_TO_CURRENCY[lang];
            }
            // Heuristic: if region is CA, return CAD even on weird tags.
            if (/\bCA\b/i.test(tag)) return "CAD";
        } catch (_) {}
        return "CAD"; // Canada-default per spec
    }

    function detectBrowserLanguage() {
        try {
            const code = (navigator.language || "en").split("-")[0].toLowerCase();
            if (SUPPORTED_LANGS.includes(code)) return code;
        } catch (_) {}
        return "en";
    }

    function populateOnboardingCurrencies() {
        const select = document.getElementById("onboardingCurrency");
        if (!select || select.options.length > 0) return;
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = t("currency.placeholder", "Select currency");
        select.appendChild(placeholder);
        if (typeof CURRENCIES !== "undefined" && Array.isArray(CURRENCIES)) {
            CURRENCIES.forEach(([name, code]) => {
                const opt = document.createElement("option");
                opt.value = code;
                opt.textContent = `${name} (${code})`;
                select.appendChild(opt);
            });
        }
    }

    function showStep(n) {
        activeStep = Math.max(1, Math.min(TOTAL_STEPS, n));
        document.querySelectorAll("[data-onboarding-step]").forEach(panel => {
            const idx = Number(panel.getAttribute("data-onboarding-step"));
            panel.hidden = idx !== activeStep;
        });
        document.querySelectorAll(".onboarding-progress-dot").forEach(dot => {
            const idx = Number(dot.getAttribute("data-step-dot"));
            dot.classList.toggle("active", idx === activeStep);
            dot.classList.toggle("done", idx < activeStep);
        });
        const counter = document.getElementById("onboardingStepCounter");
        if (counter) counter.textContent = `${activeStep} / ${TOTAL_STEPS}`;
        const backBtn = document.getElementById("onboardingBackBtn");
        if (backBtn) backBtn.hidden = activeStep === 1;
        updateNextButton();
    }

    function updateNextButton() {
        const btn = document.getElementById("onboardingNextBtn");
        if (!btn) return;
        let label;
        let canAdvance = false;
        if (activeStep === 1) {
            label = t("onboarding.continue", "Continue");
            canAdvance = !!state.goal;
        } else if (activeStep === 2) {
            label = t("onboarding.continue", "Continue");
            canAdvance = !!state.currency && !!state.language;
        } else if (activeStep === 3) {
            label = t("onboarding.continue", "Continue");
            canAdvance = (state.account_nickname || "").trim().length > 0;
        } else {
            label = t("onboarding.finish", "Finish setup");
            canAdvance = !!state.first_action;
        }
        btn.textContent = label;
        btn.disabled = !canAdvance || saving;
        btn.setAttribute("data-i18n", activeStep === 4 ? "onboarding.finish" : "onboarding.continue");
    }

    function bindOnce() {
        if (initialized) return;
        initialized = true;

        // Step 1: goal cards
        document.querySelectorAll(".onboarding-goal-card").forEach(card => {
            card.addEventListener("click", () => {
                const goal = card.getAttribute("data-goal");
                state.goal = goal;
                document.querySelectorAll(".onboarding-goal-card").forEach(c => c.classList.remove("selected"));
                card.classList.add("selected");
                updateNextButton();
            });
        });

        // Step 2: currency + language
        const currencySelect = document.getElementById("onboardingCurrency");
        const languageSelect = document.getElementById("onboardingLanguage");
        if (currencySelect) {
            currencySelect.addEventListener("change", () => {
                state.currency = currencySelect.value;
                updateNextButton();
            });
        }
        if (languageSelect) {
            languageSelect.addEventListener("change", () => {
                state.language = languageSelect.value;
                // Apply language live so the rest of the modal reflects the choice.
                if (typeof applyLanguage === "function" && SUPPORTED_LANGS.includes(state.language)) {
                    applyLanguage(state.language);
                }
                updateNextButton();
            });
        }

        // Step 3: account + balance
        const nameInput = document.getElementById("onboardingAccountName");
        const balanceInput = document.getElementById("onboardingStartingBalance");
        if (nameInput) {
            nameInput.addEventListener("input", () => {
                state.account_nickname = nameInput.value;
                updateNextButton();
            });
        }
        if (balanceInput) {
            balanceInput.addEventListener("input", () => {
                state.starting_balance = balanceInput.value;
            });
        }

        // Step 4: first transactions
        document.querySelectorAll(".onboarding-first-card").forEach(card => {
            card.addEventListener("click", () => {
                const action = card.getAttribute("data-first");
                state.first_action = action;
                document.querySelectorAll(".onboarding-first-card").forEach(c => c.classList.remove("selected"));
                card.classList.add("selected");
                updateNextButton();
            });
        });

        // Footer nav
        const backBtn = document.getElementById("onboardingBackBtn");
        const nextBtn = document.getElementById("onboardingNextBtn");
        if (backBtn) backBtn.addEventListener("click", () => showStep(activeStep - 1));
        if (nextBtn) nextBtn.addEventListener("click", onNextClick);
    }

    async function onNextClick() {
        if (saving) return;
        if (activeStep < TOTAL_STEPS) {
            showStep(activeStep + 1);
            return;
        }
        await submitOnboarding();
    }

    async function submitOnboarding() {
        saving = true;
        updateNextButton();
        try {
            const payload = {
                goal: state.goal || "",
                currency: state.currency || "",
                language: state.language || "",
                account_nickname: (state.account_nickname || "").trim(),
                starting_balance: state.starting_balance === "" ? null : Number(state.starting_balance),
            };
            const res = await fetch(API + "/onboarding/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Onboarding save failed");
            const data = await res.json();
            if (data.user && typeof applyCurrentUserProfile === "function") {
                // Re-apply but with the new onboarding_completed_at set so the
                // gate inside applyCurrentUserProfile doesn't re-open us.
                applyCurrentUserProfile(data.user);
            }
            postSubmitAction = state.first_action;
            closeOnboardingModal();
            // Trigger the chosen first-transaction action after a tiny tick
            // so the onboarding modal has finished its close transition.
            setTimeout(() => {
                if (postSubmitAction === "scan" && typeof openScanReceiptModal === "function") {
                    openScanReceiptModal();
                } else if (postSubmitAction === "csv" && typeof openCsvModal === "function") {
                    openCsvModal();
                }
                postSubmitAction = null;
                // Refresh dashboard data so the opening-balance shows up if entered.
                if (typeof loadTransactions === "function") {
                    try { loadTransactions(); } catch (_) {}
                }
            }, 120);
            if (typeof showToast === "function") {
                showToast(t("onboarding.saved", "You're all set."));
            }
        } catch (err) {
            console.error("Onboarding save error:", err);
            if (typeof showToast === "function") {
                showToast(t("onboarding.save_error", "Couldn't save just yet — please try again."));
            }
        } finally {
            saving = false;
            updateNextButton();
        }
    }

    window.openOnboardingModal = function openOnboardingModal(user) {
        const modal = document.getElementById("onboardingModal");
        if (!modal) return;
        // Guard against double-open if applyCurrentUserProfile is called twice.
        if (modal.style.display === "flex") return;

        bindOnce();
        populateOnboardingCurrencies();

        // Pre-populate state from user + browser detection.
        state.goal = null;
        state.currency = (user && user.preferred_currency) || detectBrowserCurrency() || "CAD";
        state.language = (user && user.preferred_language) || detectBrowserLanguage() || "en";
        state.account_nickname = "";
        state.starting_balance = "";
        state.first_action = null;

        const currencySelect = document.getElementById("onboardingCurrency");
        const languageSelect = document.getElementById("onboardingLanguage");
        if (currencySelect) currencySelect.value = state.currency;
        if (languageSelect) languageSelect.value = state.language;

        document.querySelectorAll(".onboarding-goal-card").forEach(c => c.classList.remove("selected"));
        document.querySelectorAll(".onboarding-first-card").forEach(c => c.classList.remove("selected"));
        const nameInput = document.getElementById("onboardingAccountName");
        const balanceInput = document.getElementById("onboardingStartingBalance");
        if (nameInput) nameInput.value = "";
        if (balanceInput) balanceInput.value = "";

        showStep(1);
        modal.style.display = "flex";
        document.body.classList.add("modal-open");
    };

    window.closeOnboardingModal = function closeOnboardingModal() {
        const modal = document.getElementById("onboardingModal");
        if (!modal) return;
        modal.style.display = "none";
        document.body.classList.remove("modal-open");
    };
})();

// ──────────────────────────────────────────────────────────────────────────
//  Delete Account flow — Settings → Danger zone
// ──────────────────────────────────────────────────────────────────────────
(function setupDeleteAccountFlow() {
    function $(id) { return document.getElementById(id); }

    function openModal() {
        const modal = $("deleteAccountModal");
        const input = $("deleteAccountConfirmInput");
        const confirmBtn = $("deleteAccountConfirm");
        const errorEl = $("deleteAccountError");
        if (!modal) return;

        if (input) input.value = "";
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = t("delete.account.confirm", "Delete my account");
        }
        if (errorEl) {
            errorEl.hidden = true;
            errorEl.textContent = "";
        }

        modal.style.display = "flex";
        document.body.classList.add("modal-open");
        // Auto-focus the confirmation input so it's a single keystroke away.
        setTimeout(() => { if (input) input.focus(); }, 50);
    }

    function closeModal() {
        const modal = $("deleteAccountModal");
        if (!modal) return;
        modal.style.display = "none";
        document.body.classList.remove("modal-open");
    }

    function isConfirmed() {
        const input = $("deleteAccountConfirmInput");
        return input && input.value.trim().toLowerCase() === "delete";
    }

    function onInputChange() {
        const confirmBtn = $("deleteAccountConfirm");
        if (confirmBtn) confirmBtn.disabled = !isConfirmed();
    }

    async function onSubmit(event) {
        if (event) event.preventDefault();
        if (!isConfirmed()) return;

        const confirmBtn = $("deleteAccountConfirm");
        const errorEl = $("deleteAccountError");
        const cancelBtn = $("deleteAccountCancel");

        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = t("delete.account.deleting", "Deleting…");
        }
        if (cancelBtn) cancelBtn.disabled = true;
        if (errorEl) { errorEl.hidden = true; errorEl.textContent = ""; }

        try {
            const res = await fetch(API + "/account/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirmation: "delete" }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || t("delete.account.error_generic", "Could not delete account. Please try again."));
            }
            // Success — clear local state and bounce to the landing page.
            try { localStorage.clear(); } catch (e) {}
            window.location.href = "landing.html?account_deleted=1";
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = err.message || t("delete.account.error_generic", "Could not delete account. Please try again.");
                errorEl.hidden = false;
            }
            if (confirmBtn) {
                confirmBtn.disabled = !isConfirmed();
                confirmBtn.textContent = t("delete.account.confirm", "Delete my account");
            }
            if (cancelBtn) cancelBtn.disabled = false;
        }
    }

    function bindOnce() {
        const openBtn = $("deleteAccountBtn");
        const closeBtn = $("deleteAccountModalClose");
        const cancelBtn = $("deleteAccountCancel");
        const form = $("deleteAccountForm");
        const input = $("deleteAccountConfirmInput");
        const modal = $("deleteAccountModal");

        if (openBtn) openBtn.addEventListener("click", openModal);
        if (closeBtn) closeBtn.addEventListener("click", closeModal);
        if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
        if (form) form.addEventListener("submit", onSubmit);
        if (input) input.addEventListener("input", onInputChange);
        if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindOnce);
    } else {
        bindOnce();
    }
})();
