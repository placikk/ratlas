-- Katalog startowy Szczurzej Biblioteki. Teksty własne, ze źródłami; przed publicznym startem do przeczytania przez właściciela.

insert into public.reward_items (id, type, name, teaser, price, sort_order, content) values
('card_species', 'knowledge_card', 'Szczur wędrowny i szczur śniady', 'Który szczur mieszka we Wrocławiu?', 30, 1, $j${
  "body": [
    "W polskich miastach niemal zawsze spotkasz szczura wędrownego (Rattus norvegicus), zwanego też brunatnym. Jest krępy, ma tępo zakończony pysk, małe uszy i ogon krótszy niż reszta ciała. Dorosły waży zwykle od 200 do 500 gramów.",
    "Szczur śniady (Rattus rattus) jest smuklejszy, ma duże uszy i ogon dłuższy niż ciało. Świetnie się wspina i chętniej mieszka na strychach niż w piwnicach. W Europie Środkowej szczur wędrowny w dużej mierze go wyparł, więc dziś jest u nas rzadki.",
    "Mimo łacińskiej nazwy „norvegicus” szczur wędrowny nie pochodzi z Norwegii. Badania genetyczne wskazują na Azję Wschodnią, skąd razem z ludźmi rozprzestrzenił się po całym świecie."
  ],
  "sources": [
    {"label": "Wikipedia: Szczur wędrowny", "url": "https://pl.wikipedia.org/wiki/Szczur_wędrowny"},
    {"label": "Wikipedia: Szczur śniady", "url": "https://pl.wikipedia.org/wiki/Szczur_śniady"}
  ]
}$j$::jsonb),
('card_laugh', 'knowledge_card', 'Czy szczury się śmieją?', 'Łaskotanie w laboratorium', 30, 2, $j${
  "body": [
    "Na swój sposób tak. Neurobiolog Jaak Panksepp odkrył, że łaskotane szczury wydają krótkie piski o częstotliwości około 50 kHz, których ludzkie ucho nie słyszy. Nazwał je „szczurzym śmiechem”.",
    "Łaskotane szczury chętnie wracają do ręki, która je łaskotała. W 2016 roku badacze z Berlina pokazali, że za ten „śmiech” odpowiada konkretny obszar kory mózgowej. Szczury „śmieją się” też podczas zabawy z innymi szczurami.",
    "To nie powód, żeby łaskotać dzikie szczury! Dzikie zwierzę może ugryźć i przenosić choroby — fotografuj z dystansu."
  ],
  "sources": [
    {"label": "Panksepp i Burgdorf (2003), Physiology & Behavior", "url": "https://doi.org/10.1016/S0031-9384(03)00159-8"},
    {"label": "Ishiyama i Brecht (2016), Science", "url": "https://doi.org/10.1126/science.aah5114"}
  ]
}$j$::jsonb),
('card_health', 'knowledge_card', 'Szczury a zdrowie', 'Dlaczego nie dotykamy szczurów', 30, 3, $j${
  "body": [
    "Dzikie szczury mogą przenosić choroby groźne dla ludzi. Jedną z nich jest leptospiroza: bakterie Leptospira są wydalane z moczem zwierząt, a człowiek może się zarazić przez skaleczoną skórę lub błony śluzowe, na przykład przy kontakcie ze skażoną wodą lub ziemią.",
    "Szczury mogą też przenosić między innymi hantawirusy i bakterie Salmonella. Dlatego zasady są proste: nie dotykaj szczurów ani ich odchodów, nie wchodź do kanałów, a po sprzątaniu piwnicy czy pracy w ogrodzie dokładnie myj ręce.",
    "Jeśli po kontakcie z wodą, w której mogły być szczury, pojawi się gorączka albo bóle mięśni i głowy, powiedz lekarzowi o tym kontakcie."
  ],
  "sources": [
    {"label": "Wikipedia: Leptospiroza", "url": "https://pl.wikipedia.org/wiki/Leptospiroza"},
    {"label": "Wikipedia: Brown rat (choroby)", "url": "https://en.wikipedia.org/wiki/Brown_rat"}
  ]
}$j$::jsonb),
('card_swim', 'knowledge_card', 'Mistrzowie pływania', 'Jak szczury radzą sobie z wodą', 30, 4, $j${
  "body": [
    "Szczury wędrowne bardzo dobrze pływają i nurkują. Potrafią przedostać się przez zalaną rurę i wspiąć się po jej ściankach, dlatego tak dobrze czują się w kanalizacji.",
    "Lubią miejsca blisko wody: nabrzeża, kanały i brzegi rzek. Wrocław z Odrą, jej odnogami i kanałami ma dla nich wyjątkowo dużo takich miejsc.",
    "Szczur przeciśnie się przez szczelinę niewiele większą niż jego głowa. Dlatego dziury w ścianach piwnic i wokół rur warto szczelnie zabezpieczać."
  ],
  "sources": [
    {"label": "Wikipedia: Brown rat", "url": "https://en.wikipedia.org/wiki/Brown_rat"}
  ]
}$j$::jsonb),
('card_teeth', 'knowledge_card', 'Zęby, które ciągle rosną', 'Dlaczego szczur wciąż coś gryzie', 30, 5, $j${
  "body": [
    "Jak wszystkie gryzonie, szczur ma cztery długie siekacze, które rosną przez całe życie. Gdyby się nie ścierały, urosłyby tak bardzo, że szczur nie mógłby jeść — dlatego ciągle coś gryzie.",
    "Pomarańczowy kolor zębów to nie brud: szkliwo siekaczy szczura zawiera żelazo, które czyni je twardszymi.",
    "Szczury przegryzają drewno, plastik, a nawet izolację kabli. To jedna z głównych przyczyn szkód, jakie wyrządzają w budynkach."
  ],
  "sources": [
    {"label": "Wikipedia: Gryzonie", "url": "https://pl.wikipedia.org/wiki/Gryzonie"},
    {"label": "Wikipedia: Rodent (zęby)", "url": "https://en.wikipedia.org/wiki/Rodent"}
  ]
}$j$::jsonb),
('card_senses', 'knowledge_card', 'Wąsy, nos i ultrafiolet', 'Jak szczur poznaje świat', 30, 6, $j${
  "body": [
    "Szczury nie widzą ostro, ale ich oczy rejestrują światło ultrafioletowe, którego ludzie nie widzą.",
    "Świat poznają głównie węchem i wąsami (wibrysami). Szybko poruszając wąsami, „omiatają” otoczenie i nawet w ciemności rozpoznają kształty i faktury.",
    "Węch gryzoni jest tak czuły, że afrykańskie szczury olbrzymie szkoli się do wyszukiwania min — o tym opowiada karta „Szczury bohaterowie”."
  ],
  "sources": [
    {"label": "Wikipedia: Brown rat (zmysły)", "url": "https://en.wikipedia.org/wiki/Brown_rat"},
    {"label": "Wikipedia: Whiskers", "url": "https://en.wikipedia.org/wiki/Whiskers"}
  ]
}$j$::jsonb),
('card_herorats', 'knowledge_card', 'Szczury bohaterowie', 'Gryzonie, które ratują ludzi', 30, 7, $j${
  "body": [
    "Organizacja APOPO z Tanzanii szkoli afrykańskie szczury olbrzymie do wyszukiwania min lądowych. Szczur jest za lekki, żeby zdetonować minę, a węchem przeszukuje teren znacznie szybciej niż człowiek z wykrywaczem metalu.",
    "Najsłynniejszy z nich, Magawa, wywęszył w Kambodży ponad 100 min i niewybuchów. W 2020 roku jako pierwszy szczur dostał złoty medal brytyjskiej organizacji PDSA za odwagę.",
    "Szczury APOPO uczą się też rozpoznawać po zapachu próbki, w których są bakterie gruźlicy."
  ],
  "sources": [
    {"label": "APOPO", "url": "https://apopo.org"},
    {"label": "Wikipedia: Magawa", "url": "https://en.wikipedia.org/wiki/Magawa"}
  ]
}$j$::jsonb),
('card_empathy', 'knowledge_card', 'Szczurza empatia', 'Eksperyment z uwięzionym kolegą', 30, 8, $j${
  "body": [
    "W 2011 roku badacze z Uniwersytetu w Chicago zamykali szczura w ciasnej rurce i obserwowali jego towarzysza z klatki. Wolny szczur uczył się otwierać drzwiczki i uwalniał uwięzionego kolegę, choć nie dostawał za to żadnej nagrody.",
    "Gdy obok stała druga rurka z czekoladą, szczury często i tak uwalniały kolegę, a potem dzieliły się z nim smakołykiem.",
    "Szczury to zwierzęta stadne: śpią przytulone, czyszczą sobie nawzajem futro i uczą się od siebie, co jest bezpieczne do jedzenia."
  ],
  "sources": [
    {"label": "Bartal, Decety i Mason (2011), Science", "url": "https://doi.org/10.1126/science.1210789"}
  ]
}$j$::jsonb),
('card_culture', 'knowledge_card', 'Szczury w kulturze', 'Od zodiaku po kuchnię w Paryżu', 30, 9, $j${
  "body": [
    "W chińskim zodiaku Szczur otwiera cykl dwunastu zwierząt. Według legendy wygrał wyścig, jadąc na grzbiecie wołu i zeskakując na metę tuż przed nim.",
    "Legenda o Szczurołapie z Hameln opowiada o grajku, który w 1284 roku wyprowadził z miasta szczury, a gdy mu nie zapłacono, także dzieci.",
    "Współczesny szczur ma też dobrą prasę: Remy z filmu animowanego „Ratatuj” (2007) marzył, by zostać szefem kuchni w Paryżu."
  ],
  "sources": [
    {"label": "Wikipedia: Szczurołap z Hameln", "url": "https://pl.wikipedia.org/wiki/Szczurołap_z_Hameln"},
    {"label": "Wikipedia: Chinese zodiac", "url": "https://en.wikipedia.org/wiki/Chinese_zodiac"},
    {"label": "Wikipedia: Ratatuj", "url": "https://pl.wikipedia.org/wiki/Ratatuj"}
  ]
}$j$::jsonb),
('card_family', 'knowledge_card', 'Szczurza rodzina', 'Dlaczego szczurów szybko przybywa', 30, 10, $j${
  "body": [
    "Samica szczura wędrownego jest w ciąży około trzech tygodni i rodzi zwykle od 6 do 12 młodych. Młode rodzą się ślepe i bez futra, a po kilku tygodniach są już samodzielne. W dobrych warunkach samica może mieć kilka miotów w roku.",
    "Dziki szczur żyje krótko — zwykle mniej niż rok. W domowej hodowli szczury dożywają 2–3 lat.",
    "Gdy szczury mają dużo jedzenia i kryjówek, ich liczba szybko rośnie. Najlepszy sposób na mniej szczurów w mieście to mniej łatwego jedzenia: zamknięte śmietniki i niewyrzucanie resztek na trawniki."
  ],
  "sources": [
    {"label": "Wikipedia: Brown rat (rozmnażanie)", "url": "https://en.wikipedia.org/wiki/Brown_rat"}
  ]
}$j$::jsonb),
('quiz_body', 'quiz', 'Quiz: ciało i gatunki', '5 pytań o to, jak zbudowany jest szczur', 50, 11, $j${
  "questions": [
    {"question": "Który szczur najczęściej żyje w polskich miastach?", "answers": ["Szczur śniady", "Szczur wędrowny", "Szczur olbrzymi"], "correct": 1, "explain": "Szczur wędrowny (brunatny) w dużej mierze wyparł u nas szczura śniadego."},
    {"question": "Po czym rozpoznasz szczura śniadego?", "answers": ["Ogon dłuższy niż ciało i duże uszy", "Krótki ogon i małe uszy", "Białe łapki"], "correct": 0, "explain": "Szczur śniady jest smukły, ma duże uszy i bardzo długi ogon."},
    {"question": "Dlaczego zęby szczura są pomarańczowe?", "answers": ["Od brudu", "Szkliwo zawiera żelazo", "Od jedzenia marchewki"], "correct": 1, "explain": "Żelazo w szkliwie barwi siekacze i czyni je twardszymi."},
    {"question": "Co się dzieje z siekaczami szczura przez całe życie?", "answers": ["Wypadają co roku", "Przestają rosnąć po roku", "Ciągle rosną"], "correct": 2, "explain": "Siekacze gryzoni rosną całe życie i ścierają się podczas gryzienia."},
    {"question": "Skąd pochodzi szczur wędrowny?", "answers": ["Z Norwegii", "Z Azji Wschodniej", "Z Ameryki Południowej"], "correct": 1, "explain": "Mimo nazwy „norvegicus” jego przodkowie żyli w Azji Wschodniej."}
  ]
}$j$::jsonb),
('quiz_mind', 'quiz', 'Quiz: szczurzy umysł i zmysły', '5 pytań o to, jak szczur myśli i czuje', 50, 12, $j${
  "questions": [
    {"question": "Jak brzmi „szczurzy śmiech”?", "answers": ["Jak głośne chichotanie", "To piski ok. 50 kHz, niesłyszalne dla ludzi", "Jak tupanie łapkami"], "correct": 1, "explain": "Łaskotane szczury piszczą w ultradźwiękach."},
    {"question": "Czym szczury poznają otoczenie w ciemności?", "answers": ["Wąsami i węchem", "Echolokacją jak nietoperze", "Wzrokiem w podczerwieni"], "correct": 0, "explain": "Wibrysy i nos to najważniejsze zmysły szczura."},
    {"question": "Jakie światło widzą szczury, a ludzie nie?", "answers": ["Podczerwień", "Ultrafiolet", "Żadne"], "correct": 1, "explain": "Oczy szczura rejestrują ultrafiolet."},
    {"question": "Co robiły wolne szczury w eksperymencie z 2011 roku?", "answers": ["Ignorowały uwięzionego kolegę", "Uwalniały uwięzionego kolegę", "Zjadały całą czekoladę same"], "correct": 1, "explain": "Uwalniały kolegę, nawet gdy obok czekała czekolada."},
    {"question": "Skąd szczur wie, co jest bezpieczne do jedzenia?", "answers": ["Uczy się od innych szczurów", "Rozpoznaje to po kolorze", "Wcale tego nie wie"], "correct": 0, "explain": "Szczury uczą się od siebie nawzajem, także tego, co jeść."}
  ]
}$j$::jsonb),
('quiz_people', 'quiz', 'Quiz: szczury i ludzie', '5 pytań o nasze wspólne sprawy', 50, 13, $j${
  "questions": [
    {"question": "Jak można zarazić się leptospirozą?", "answers": ["Przez kontakt skaleczonej skóry ze skażoną wodą", "Patrząc na szczura", "Przez telefon"], "correct": 0, "explain": "Bakterie są w moczu zwierząt i wnikają przez rany oraz błony śluzowe."},
    {"question": "Czym zajmują się szczury z organizacji APOPO?", "answers": ["Wykrywaniem min i gruźlicy", "Sprzątaniem kanałów", "Występami w cyrku"], "correct": 0, "explain": "Afrykańskie szczury olbrzymie węchem znajdują miny i bakterie gruźlicy."},
    {"question": "W którym roku według legendy Szczurołap wyprowadził szczury z Hameln?", "answers": ["1284", "1648", "1918"], "correct": 0, "explain": "Legenda umieszcza te wydarzenia w 1284 roku."},
    {"question": "Który znak otwiera chiński zodiak?", "answers": ["Smok", "Szczur", "Tygrys"], "correct": 1, "explain": "Szczur wygrał wyścig dzięki sprytowi i grzbietowi wołu."},
    {"question": "Co najlepiej ogranicza liczbę szczurów w mieście?", "answers": ["Dokarmianie ich chlebem", "Zamknięte śmietniki i brak resztek na trawnikach", "Głośna muzyka"], "correct": 1, "explain": "Mniej łatwego jedzenia oznacza mniej szczurów."}
  ]
}$j$::jsonb),
('pin_night', 'pin_skin', 'Nocny szczur', 'Ciemne futro na nocne łowy', 200, 21, '{"skin":"night"}'),
('pin_sewer', 'pin_skin', 'Kanałowy szczur', 'Zielonkawy odcień prosto z kanałów', 250, 22, '{"skin":"sewer"}'),
('pin_gold', 'pin_skin', 'Złoty szczur', 'Twoje pinezki lśnią złotem', 300, 23, '{"skin":"gold"}'),
('title_detective', 'title', 'Kanałowy Detektyw', 'Tytuł przy Twoim pseudonimie', 100, 31, '{"label":"Kanałowy Detektyw"}'),
('title_trash', 'title', 'Postrach Śmietników', 'Tytuł przy Twoim pseudonimie', 120, 32, '{"label":"Postrach Śmietników"}'),
('title_odra', 'title', 'Wilk znad Odry', 'Tytuł przy Twoim pseudonimie', 150, 33, '{"label":"Wilk znad Odry"}');
