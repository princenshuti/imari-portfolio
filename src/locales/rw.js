/**
 * Kinyarwanda — v1, best-effort.
 *
 * ⚠ THIS LOCALE NEEDS NATIVE REVIEW before being marketed as fully
 *   supported. Common UI verbs and greetings are reasonably reliable;
 *   financial / RRA-specific vocabulary (CGT, withholding, fixed asset
 *   tax, depreciation, etc.) is best translated by a Rwandan finance
 *   professional. Missing keys fall back to English at runtime.
 *
 * Borrowed terms (kept verbatim because the English / French form is
 * what Rwandans actually use in financial contexts):
 *   RWF, USD, EUR, KES, MoMo, RRA, BNR, RSE, SACCO
 */
export default {
  nav: {
    group_overview: 'Incamake',
    group_wealth:   'Ubutunzi',
    group_money:    'Amafaranga & Isoko',
    group_tools:    'Ibikoresho',
    dashboard:   'Imbonerahamwe',
    assets:      'Ibyo utunze',
    liabilities: 'Imyenda',
    cashflow:    'Amafaranga ahita',
    goals:       'Intego',
    accounts:    'Konti',
    trends:      'Imihindukire',
    tax:         'Raporo y\'umusoro',
    advisor:     'Umujyanama wa AI',
    settings:    'Igenamiterere',
    home_label:  'Jya ku Mbonerahamwe',
    expand:      'Funguza urutonde',
    collapse:    'Funga urutonde',
    net_worth:   'Ubutunzi nyabwo',
    assets_short:'Ibyo utunze',
    debt:        'Umwenda',
    synced:      'Byabitswe ku cloud',
    saved_local: 'Byabitswe muri muraza',
  },

  currency: {
    label:   'Ifaranga ryerekanwa',
    tooltip: 'Kwerekana gusa — agaciro nyako kabitswe mu ifaranga ryako bwite.',
  },

  common: {
    cancel:  'Hagarika',
    save:    'Bika',
    delete:  'Siba',
    edit:    'Hindura',
    add:     'Ongeraho',
    close:   'Funga',
    retry:   'Ongera ugerageze',
    back:    'Subira inyuma',
    next:    'Komeza',
    confirm: 'Emeza',
    loading: 'Birapakira…',
  },

  landing: {
    nav: {
      why:      'Kuki Imari',
      features: 'Ibikorwa',
      security: 'Umutekano',
      signin:   'Injira',
    },
    hero: {
      eyebrow:        'Igikoresho cy\'ubutunzi · Cyakorewe u Rwanda',
      headline_1:     'Hagarika gukeka',
      headline_2:     'ubutunzi bwawe.',
      sub:            'Niba amafaranga yawe ari mu mabanki menshi, MoMo, USD, ubutaka n\'andi mishinga, urakeka ubutunzi bwawe — kandi akenshi uribeshya. Imari ihagarika gukeka: konti zose n\'ibyo utunze biri ahantu hamwe, muri RWF na USD, hashingiwe ku gaciro wanditse — kugira ngo umenye aho uhagaze uyu munsi.',
      cta_primary:    'Tangira — ni ubuntu',
      cta_secondary:  'Mfite konti',
      trust:          'Tangira ubuntu. Nta ikarita, nta amagambo y\'ibanga ya banki — bishyizwemo umuziro.',
    },
    preview: {
      label:        'Ubutunzi',
      delta_period: 'iki gihembwe',
      savings_rate: 'Igipimo cyo kuzigama',
      goal_house:   'Intego · Inzu',
    },
    problem: {
      eyebrow: 'Ikibazo',
      title:   'Gukurikirana ubutunzi mu Rwanda ntibikora neza.',
      sub:     'Ama-spreadsheet ahita atakaza agaciro. Apps za banki zerekana igice gusa. Ibikoresho rusange ntibizi MoMo, ntibizi RWF, kandi ntibimenya icyo RRA isaba muri Mata. Ubwawe nibwo wisanga ufite akazi gakomeye — gukeka.',
      pain_1_title: 'Ubutunzi bwawe burakwirakwiranye',
      pain_1_desc:  'Amabanki atatu, MoMo ebyiri, USD, impamyabumenyi y\'ubutaka, obligation wabonye mu mwaka ushize. Nta hantu byerekanwa hamwe — ubutunzi bwawe ni uguhanura gusa.',
      pain_2_title: 'Imibare ntiyigeze yujuje',
      pain_2_desc:  'Guhindura RWF na USD mu mutwe ni nko gukubita ifaranga. Niko bimeze no ku kibazo "ese ndi neza kurusha igihembwe gishize?". Byombi bikeneye umubare nyako.',
      pain_3_title: 'Igihe cy\'umusoro ni urujijo',
      pain_3_desc:  'Iyo RRA ibajije, wongera kubaka amezi cumi n\'abiri uhereye ku nyemezabuguzi, SMS n\'amafoto — buri mwaka. Hari uburyo bworoshye bwo kubika ibyo.',
    },
    solution: {
      eyebrow: 'Igisubizo',
      title:   'Application imwe y\'ubutunzi bwawe bwose.',
      sub:     'Imari ihuza konti zose, ibyo utunze, imyenda n\'intego mu mbonerahamwe imwe — amafaranga atandukanye, ubutunzi butandukanye, kandi yakorewe amabanki, MoMo n\'amategeko bikoreshwa mu Rwanda.',
    },
    security: {
      eyebrow: 'Yakorewe icyizere',
      title:   'Amafaranga yawe ni ibanga. Amakuru yawe ni ayawe.',
      sub:     'Imari ifite amakuru nk\'ayo banki yawe ifite — bityo turayarinda kimwe: umuziro mu gukwirakwiza no mu kubika, kwitandukanya kwa konti zose, no kutigera dukusanya ibirengeje icyo application ikeneye.',
    },
    how: {
      eyebrow: 'Uko bikora',
      title:   'Kuva ku zeru kugera ku shusho yuzuye, mu masaha make.',
    },
    footer: {
      title_1: 'Menya ubutunzi bwawe.',
      title_2: 'Uhereye uyu munsi.',
      sub:     'Tangira ubuntu — nta ikarita, nta amagambo y\'ibanga ya banki. Ni shusho ya mbere yuzuye y\'amafaranga yawe, yakorewe u Rwanda.',
      cta_create: 'Kora konti yawe',
      cta_signin: 'Injira',
      powered_by: 'Bishyigikiwe na',
    },
  },

  login: {
    welcome_signin:  'Murakaza neza kuri Imari.',
    welcome_signup:  'Kora konti yawe.',
    welcome_forgot:  'Hindura ijambobanga ryawe.',
    sub_signin:      'Injira cyangwa ukore konti kugira ngo ugere ku butunzi bwawe.',
    sub_signup:      'Imari ishyiramo umuziro ijambobanga ryawe ikariza mu mutekano kuri Supabase.',
    sub_forgot:      'Andika email yawe — tukohereze umurongo wo guhindura ijambobanga.',
    sub_invite:      'Watumiwe nka {role}. Injira cyangwa ukore konti na {email} kugira ngo wifatanye nuyu mushinga.',
    email_label:     'Email',
    password_label:  'Ijambobanga',
    password_short:  'Nibura inyuguti 8',
    forgot_link:     'Wibagiwe ijambobanga?',
    submit_signin:   'Injira →',
    submit_signup:   'Kora konti →',
    submit_forgot:   'Ohereza umurongo →',
    submit_loading:  'Tegereza gato…',
    no_account:      'Nta konti ufite?',
    has_account:     'Usanzwe ufite konti?',
    remember:        'Wibutse ijambobanga ryawe?',
    create_one:      'Kora konti',
    do_signin:       'Injira',
    back_home:       '← Subira ku rugo',
    reset_sent:      'Niba konti ibaho kuri iyo email, umurongo wo guhindura ijambobanga woherejwe. Reba mu nbox yawe.',
    check_email:     'Reba email yawe kugira ngo wemeze konti.',
    powered_by:      'Bishyigikiwe na',
  },

  onboarding: {
    name_title:    'Murakaza neza — twakwita iki?',
    name_greeting: 'Muraho.',
    name_sub:      'Murakaza neza kuri portail y\'ubutunzi bwawe. Twakwita iki?',
    name_placeholder: 'Izina ryawe',
    name_continue: 'Komeza →',
    name_privacy:  'Amakuru yawe agumana muri navigateur. Nta kintu kigenda keretse wibitse.',
    welcome:       'Murakaza neza, {name}.',
    sub:           'Ongeraho ibyo utunze kugira ngo utangire gukurikirana ubutunzi bwawe. Hitamo bimwe muri ibi bikurikira — buri kimwe gifungura formulaire yujujwe.',
    cta_sample:    '↻ Pakira sample portfolio',
    cta_skip:      'Nzongeraho ibindi nyuma →',
    privacy:       'Amakuru yawe ni ibanga. Nta kintu kigenda mu konti yawe keretse wibyohereje ubwawe.',
  },

  settings: {
    appearance_title: 'Imiterere',
    theme_label:      'Imiterere',
    theme_auto:       'Yikora',
    theme_light:      'Kibonezamiterere',
    theme_dark:       'Cyumukara',
    locale_label:     'Ururimi',
    locale_hint:      'Bihindura ururimi rw\'urupapuro rw\'ikaze, urutonde, kwinjira, no gushyiraho. Imbere ya application iracyari mu cyongereza ubu.',
  },
};
