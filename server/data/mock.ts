import { Product, Review } from '../../src/types';

const MOCK_PRODUCTS: Product[] = [
  {
    id: "prod-01",
    name: "Abelha amigurumi media",
    description: "Artesanato em linha de crochê em formato de abelha, tamanho médio. Feito à mão com muito carinho e detalhes fofos.",
    price: 55.00,
    imageUrl: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Outros",
    slug: "abelha-amigurumi-media",
    active: true
  },
  {
    id: "prod-02",
    name: "Bálsamo corporal 100g - Ervas (pernas cansadas)",
    description: "Fórmula regeneradora e relaxante para massagem. Composição: Manteiga de karité, óleo de coco, cera de abelha, mel & própolis com sinergia de ervas calmantes.",
    price: 60.00,
    imageUrl: "https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Bálsamos",
    slug: "balsamo-corporal-100g-ervas-pernas-cansadas",
    active: true
  },
  {
    id: "prod-03",
    name: "Bálsamo corporal 100g - Jasmim",
    description: "Nutrição profunda com o aroma envolvente do jasmim. Composição: Manteiga de karité, óleo de coco, cera de abelha, mel & própolis.",
    price: 60.00,
    imageUrl: "https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Bálsamos",
    slug: "balsamo-corporal-100g-jasmim",
    active: true
  },
  {
    id: "prod-04",
    name: "Bálsamo corporal 100g - Neutro",
    description: "Pele macia e altamente protegida, sem fragrância adicionada. Composição: Manteiga de karité, óleo de coco, cera de abelha, mel & própolis.",
    price: 60.00,
    imageUrl: "https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Bálsamos",
    slug: "balsamo-corporal-100g-neutro",
    active: true
  },
  {
    id: "prod-05",
    name: "Bálsamo labial incolor - Aroma Tutti-Frutti",
    description: "Hidratação intensa e brilho saudável para seus lábios. Composição: Manteiga de karité, óleo de amêndoas, cera de abelha, mel & própolis.",
    price: 20.00,
    imageUrl: "https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Bálsamos",
    slug: "balsamo-labial-incolor-aroma-tutti-frutti",
    active: true
  },
  {
    id: "prod-06",
    name: "Chaveiro abelha",
    description: "Um mimo artesanal fofíssimo para carregar com você. Confeccionado em crochê artesanal com linha de alta qualidade.",
    price: 20.00,
    imageUrl: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Outros",
    slug: "chaveiro-abelha",
    active: true
  },
  {
    id: "prod-07",
    name: "Escalda pés 50g - Camomila e Lavanda",
    description: "Relaxe após um dia cansativo com este banho terapêutico para os pés. Composição: Sal rosa, lavanda, camomila, óleo essencial.",
    price: 8.00,
    imageUrl: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sais",
    slug: "escalda-pes-50g-camomila-lavanda",
    active: true
  },
  {
    id: "prod-08",
    name: "Escalda pés 50g - Alecrim",
    description: "Revigorante e estimulante para restabelecer suas energias cotidianas. Composição: Sal, bicarbonato, alecrim.",
    price: 8.00,
    imageUrl: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sais",
    slug: "escalda-pes-50g-alecrim",
    active: true
  },
  {
    id: "prod-09",
    name: "Escalda pés 50g - Lavanda",
    description: "Proporcione calmaria profunda para seu corpo e mente. Composição: Sal, bicarbonato, lavanda.",
    price: 8.00,
    imageUrl: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sais",
    slug: "escalda-pes-50g-lavanda",
    active: true
  },
  {
    id: "prod-10",
    name: "Kit adesivos",
    description: "Kit de adesivos Beerlanda decorativos e ilustrados em papel adesivo de excelente qualidade.",
    price: 12.00,
    imageUrl: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Outros",
    slug: "kit-adesivos",
    active: true
  },
  {
    id: "prod-11",
    name: "Kit ecopads - 3un",
    description: "Discos de crochê sustentáveis e reutilizáveis para skincare. Confeccionados em fio 100% algodão.",
    price: 15.00,
    imageUrl: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Outros",
    slug: "kit-ecopads-3un",
    active: true
  },
  {
    id: "prod-45",
    name: "Ecobag Beerlanda",
    description: "[PREÇO E DESCRIÇÃO PROVISÓRIOS — atualizar na planilha] Ecobag de tecido resistente e reutilizável, ideal para compras conscientes no dia a dia.",
    price: 0,
    imageUrl: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Outros",
    slug: "ecobag-beerlanda",
    active: true
  },
  {
    id: "prod-12",
    name: "Sabonete 100g - Aveia & Mel",
    description: "Deliciosa esfoliação física e nutrição intensa. Composição: Aveia, mel puro do apiário, essência.",
    price: 14.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-100g-aveia-mel",
    active: true
  },
  {
    id: "prod-13",
    name: "Sabonete 100g - Capim limão com aveia e mel",
    description: "Toque refrescante cítrico que acalma a pele. Composição: Capim limão, mel, aveia.",
    price: 14.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-100g-capim-limao-com-aveia-e-mel",
    active: true
  },
  {
    id: "prod-14",
    name: "Sabonete 100g - Capim limão óleo de coco e mel",
    description: "Espuma rica e cremosa extremamente hidratante. Composição: Capim limão, mel, óleo de coco.",
    price: 14.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-100g-capim-limao-oleo-de-coco-e-mel",
    active: true
  },
  {
    id: "prod-15",
    name: "Sabonete 100g - Erva doce com manteiga de karité e mel",
    description: "Hidratação profunda para peles delicadas e exigentes. Composição: Erva doce, mel, karité.",
    price: 14.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-100g-erva-doce-com-manteiga-de-karite-e-mel",
    active: true
  },
  {
    id: "prod-16",
    name: "Sabonete em barra - Aveia & Mel com óleo essencial de Laranja doce",
    description: "Esse sabonete é uma magia natural! Possui propriedades hidratantes, calmantes, antioxidantes, cicatrizantes e anti-inflamatórias fornecidas pela aveia e mel, além de trazer a energia e o perfume maravilhoso do óleo essencial de laranja doce na sua composição.",
    price: 14.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-em-barra-aveia-mel-laranja-doce",
    active: true
  },
  {
    id: "prod-17",
    name: "Sabonete 100g - Lavanda com manteiga de karité e mel",
    description: "Calmante natural para um banho incrivelmente relaxante. Composição: Lavanda, mel, karité.",
    price: 14.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-100g-lavanda-com-manteiga-de-karite-e-mel",
    active: true
  },
  {
    id: "prod-18",
    name: "Sabonete 100g - Lavanda e mel",
    description: "Combinação clássica que limpa suavemente enquanto relaxa. Composição: Lavanda, mel.",
    price: 14.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-100g-lavanda-e-mel",
    active: true
  },
  {
    id: "prod-19",
    name: "Sabonete 100g - Limão siciliano com manteiga de karité e mel",
    description: "Aroma cítrico marcante e energizante para renovar o corpo. Composição: Limão, mel, karité.",
    price: 14.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-100g-limao-siciliano-com-manteiga-de-karite-e-mel",
    active: true
  },
  {
    id: "prod-20",
    name: "Sabonete 100g - Mamãe e Bebê - Aveia & mel",
    description: "Cuidado extra suave para peles ultrassensíveis. Composição: Aveia, mel, essência suave.",
    price: 14.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-100g-mamae-e-bebe-aveia-mel",
    active: true
  },
  {
    id: "prod-21",
    name: "Sabonete 100g - Mel",
    description: "Nutrição e hidratação pura concentrada direto da colmeia. Composição: Extrato de mel, mel puro.",
    price: 14.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-100g-mel",
    active: true
  },
  {
    id: "prod-22",
    name: "Sabonete 120g - Erva doce com manteiga de karité e mel",
    description: "Ação relaxante associada a uma suave esfoliação natural. Composição: Erva doce, mel, bucha vegetal.",
    price: 18.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-120g-erva-doce-com-manteiga-de-karite-e-mel",
    active: true
  },
  {
    id: "prod-23",
    name: "Sabonete 120g - Laranja com açafrão e mel",
    description: "Poder termogênico e iluminador do açafrão associado ao mel. Composição: Laranja, açafrão, mel.",
    price: 18.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-120g-laranja-com-acafrao-e-mel",
    active: true
  },
  {
    id: "prod-24",
    name: "Sabonete em barra - Aveia & Mel com óleo essencial de Laranja doce - 120g",
    description: "Esse sabonete é uma magia natural! Possui propriedades hidratantes, calmantes, antioxidantes, cicatrizantes e anti-inflamatórias fornecidas pela aveia e mel, além de trazer a energia e o perfume maravilhoso do óleo essencial de laranja doce na sua composição. Com bucha vegetal embutida para esfoliação.",
    price: 18.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-em-barra-120g-aveia-mel-laranja-doce",
    active: true
  },
  {
    id: "prod-25",
    name: "Sabonete 120g - Lavanda com manteiga de karité e mel",
    description: "Efeito calmante, hidratante e esfoliante único. Composição: Lavanda, mel, bucha vegetal.",
    price: 18.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-120g-lavanda-com-manteiga-de-karite-e-mel",
    active: true
  },
  {
    id: "prod-26",
    name: "Sabonete 60g - Lavanda e mel",
    description: "Tamanho ideal para viagens e lavabos charmosos. Composição: Lavanda, mel.",
    price: 9.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-60g-lavanda-e-mel",
    active: true
  },
  {
    id: "prod-27",
    name: "Sabonete 90g - Aveia & Mel",
    description: "Equilíbrio e suavidade diária em barra nutritiva. Composição: Aveia, mel puro.",
    price: 12.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-90g-aveia-mel",
    active: true
  },
  {
    id: "prod-28",
    name: "Sabonete 90g - Capim limão óleo coco e mel",
    description: "Nutrição tropical restauradora para um banho fresco. Composição: Capim limão, mel.",
    price: 12.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-90g-capim-limao-oleo-coco-e-mel",
    active: true
  },
  {
    id: "prod-29",
    name: "Sabonete 90g - Lavanda com manteiga de karité e mel",
    description: "Acalma e nutre peles irritadas profundamente. Composição: Lavanda, mel, karité.",
    price: 12.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-90g-lavanda-com-manteiga-de-karite-e-mel",
    active: true
  },
  {
    id: "prod-30",
    name: "Sabonete 90g - Limão siciliano com manteiga de karité e mel",
    description: "Antioxidante cítrico de altíssima cremosidade protetora. Composição: Limão, mel, karité.",
    price: 12.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-90g-limao-siciliano-com-manteiga-de-karite-e-mel",
    active: true
  },
  {
    id: "prod-31",
    name: "Sabonete 90g - Mel",
    description: "O sabonete clássico mais amado do nosso apiário. Composição: Mel puro.",
    price: 12.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-90g-mel",
    active: true
  },
  {
    id: "prod-32",
    name: "Sabonete cacho de uva",
    description: "Aparência artística linda e aroma revigorante sofisticado. Composição: Laranja doce e cedro.",
    price: 34.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-cacho-de-uva",
    active: true
  },
  {
    id: "prod-33",
    name: "Sabonete facial Argila - Amarela",
    description: "Revitalização e estímulo de colágeno facial natural. Composição: Argila amarela, mel.",
    price: 12.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-facial-argila-amarela",
    active: true
  },
  {
    id: "prod-34",
    name: "Sabonete facial Argila - Cinza",
    description: "Perfeito para controle de oleosidade e efeito detox profundo. Composição: Argila cinza, mel.",
    price: 12.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-facial-argila-cinza",
    active: true
  },
  {
    id: "prod-35",
    name: "Sabonete facial Argila - Rosa",
    description: "Tratamento delicado para peles extremamente sensíveis e avermelhadas. Composição: Argila rosa, mel.",
    price: 12.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-facial-argila-rosa",
    active: true
  },
  {
    id: "prod-36",
    name: "Sabonete líquido - Erva doce & Mel",
    description: "Sabonete líquido cremoso com delicioso toque de calmaria. Composição: Erva doce, mel.",
    price: 25.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-liquido-erva-doce-mel",
    active: true
  },
  {
    id: "prod-37",
    name: "Sabonete líquido - Laranja & Mel",
    description: "Luminosidade, vitalidade e aroma cítrico irresistível. Composição: Laranja doce, mel.",
    price: 25.00,
    imageUrl: "https://images.unsplash.com/photo-1607006342411-92fc48cf7a69?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sabonetes",
    slug: "sabonete-liquido-laranja-mel",
    active: true
  },
  {
    id: "prod-38",
    name: "Sais de banho - Camomila e Lavanda",
    description: "Banho de imersão revigorante que desintoxica e perfuma suavemente. Composição: Sal rosa, lavanda, camomila.",
    price: 25.00,
    imageUrl: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Sais",
    slug: "sais-de-banho-camomila-lavanda",
    active: true
  },
  {
    id: "prod-39",
    name: "Vela na lata 130g - Citronela",
    description: "Perfumaria de ambiente que além de aromática atua como repelente natural de insetos. Composição: Cera de abelha e citronela.",
    price: 50.00,
    imageUrl: "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Velas",
    slug: "vela-na-lata-130g-citronela",
    active: true
  },
  {
    id: "prod-40",
    name: "Vela na lata 130g - Jasmim",
    description: "Atmosfera romântica, relaxante e aconchegante para momentos marcantes. Composição: Cera de abelha e jasmim.",
    price: 50.00,
    imageUrl: "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Velas",
    slug: "vela-na-lata-130g-jasmim",
    active: true
  },
  {
    id: "prod-41",
    name: "Vela na lata 130g - Laranja",
    description: "Estímulo de criatividade e frescor alegre para seus ambientes residenciais. Composição: Cera de abelha e laranja.",
    price: 50.00,
    imageUrl: "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Velas",
    slug: "vela-na-lata-130g-laranja",
    active: true
  },
  {
    id: "prod-42",
    name: "Vela na lata 130g - Lavanda",
    description: "Relaxamento garantido de altíssima pureza com cera natural de abelha. Composição: Cera de abelha e lavanda.",
    price: 50.00,
    imageUrl: "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Velas",
    slug: "vela-na-lata-130g-lavanda",
    active: true
  },
  {
    id: "prod-43",
    name: "Vela na lata 130g - Limão siciliano",
    description: "Foco mental, assepsia do ar e sensação incrível de limpeza natural. Composição: Cera de abelha e limão.",
    price: 50.00,
    imageUrl: "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Velas",
    slug: "vela-na-lata-130g-limao-siciliano",
    active: true
  },
  {
    id: "prod-44",
    name: "Vela na lata 130g - Menta & eucalipto",
    description: "Sensação refrescante e vias respiratórias desobstruídas. Composição: Cera de abelha e menta.",
    price: 50.00,
    imageUrl: "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=600",
    stock: 10,
    category: "Velas",
    slug: "vela-na-lata-130g-menta-eucalipto",
    active: true
  }
];

const MOCK_REVIEWS: Review[] = [
  {
    id: "rev-01",
    name: "Mariana Santos",
    rating: 5,
    comment: "Estou apaixonada pelo sabonete de Aveia & Mel com óleo essencial de Laranja doce! É extremamente cheiroso, hidratante e deixa a pele super macia. A entrega foi super rápida e o cuidado com a embalagem foi impecável. Recomendo demais!",
    active: true
  },
  {
    id: "rev-02",
    name: "Carlos Eduardo Costa",
    rating: 5,
    comment: "O bálsamo corporal de ervas para pernas cansadas é sensacional. Uso todo dia depois do trabalho e sinto o relaxamento imediato. Produto de altíssimo padrão, dá pra sentir o própolis e o mel na fórmula.",
    active: true
  },
  {
    id: "rev-03",
    name: "Beatriz Lima",
    rating: 5,
    comment: "O sabonete facial de argila rosa salvou minha pele. Estava com muita sensibilidade e vermelhidão por conta do frio, e em uma semana de uso já vi uma melhora absurda. Rápida absorção e cheirinho suave!",
    active: true
  },
  {
    id: "rev-04",
    name: "Dr. Roberto Silva",
    rating: 5,
    comment: "Recomendo os bálsamos à base de cera de abelha e própolis da Beerlanda para todos que buscam uma barreira de hidratação natural e regeneração da pele livre de químicos artificiais.",
    active: true
  }
];

export { MOCK_PRODUCTS, MOCK_REVIEWS };
