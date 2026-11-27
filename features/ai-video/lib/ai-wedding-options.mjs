// Culture-specific choices for the "Upload my own" ceremony scenes.
// outfits: [id, label, bride, groom] · settings: [id, label, setting text] · actions: [id, label, description]
const o = (id, label, bride, groom) => [id, label, bride, groom];
const s = (id, label, text) => [id, label, text];
const a = (id, label, text) => [id, label, text];

export const GENERIC_WEDDING_OPTIONS = {
  outfits: {
    blessing: [o("classic", "Soft pink saree / cream kurta", "Soft pink saree with simple jewellery", "Cream kurta and trousers"), o("pastel", "Pastel traditional outfits", "Pastel peach traditional outfit", "Ivory traditional outfit")],
    mehndi: [o("green", "Green silk lehenga / light-green kurta", "Green silk lehenga and flower jewellery", "Light-green kurta and printed jacket"), o("teal", "Teal lehenga / beige kurta", "Teal lehenga and floral jewellery", "Beige kurta with a teal waistcoat")],
    haldi: [o("yellow", "Yellow saree / white kurta", "Yellow cotton saree and marigold jewellery", "White kurta-pyjama"), o("mustard", "Mustard outfit / ivory kurta", "Mustard-yellow festive outfit with flower jewellery", "Ivory kurta with a mustard waistcoat")],
    sangeet: [o("pink", "Pink-and-gold lehenga / navy kurta", "Sparkling pink-and-gold lehenga", "Navy kurta with a silver Nehru jacket"), o("blue", "Midnight-blue evening outfits", "Midnight-blue embellished lehenga", "Ivory kurta with a blue embroidered jacket")],
    reception: [o("wine", "Wine-red lehenga / ivory bandhgala", "Wine-red embroidered lehenga", "Ivory bandhgala"), o("champagne", "Champagne gown / black tuxedo", "Champagne embroidered evening gown", "Black tuxedo and white shirt"), o("silver", "Silver saree / navy suit", "Silver sequinned saree with a diamond necklace", "Navy blue suit with a white shirt")],
    engagement: [o("blush", "Blush lehenga / ivory bandhgala", "Blush pink embroidered lehenga with a sheer dupatta", "Ivory bandhgala with a pink pocket square"), o("mint", "Mint lehenga / cream sherwani", "Mint green lehenga with light gold work", "Cream sherwani with a mint stole")],
    sagan: [o("pastel", "Pastel anarkali / ivory kurta", "Powder pink embroidered anarkali with a sheer dupatta", "Ivory silk kurta with a light pink Nehru jacket"), o("maroon", "Maroon suit / off-white bandhgala", "Deep maroon velvet suit with gold zari and polki earrings", "Off-white bandhgala with a maroon pocket square")],
    cocktail: [o("black", "Black gown / printed shirt", "Long black satin evening gown with a small diamond necklace", "Black-and-white printed shirt with a black blazer"), o("gold", "Champagne gown / velvet blazer", "Champagne gold sequinned gown", "Midnight blue velvet blazer with a black shirt")],
    baraat: [o("bridal", "Red lehenga / ivory sherwani and safa", "Red embroidered bridal lehenga with gold jewellery", "Ivory sherwani with a red safa and a pearl mala"), o("pastel", "Pastel lehenga / gold sherwani", "Pastel peach bridal lehenga with silver work", "Gold sherwani with a peach safa")],
  },
  settings: {
    blessing: [s("arch", "Floral entrance", "A carved entrance covered in white and marigold flowers, with brass lamps in warm golden light")],
    mehndi: [s("courtyard", "Lantern courtyard", "A lush courtyard with pink and green drapes, jasmine strings, cushions and soft lanterns"), s("terrace", "Rooftop terrace", "A rooftop terrace with colourful umbrellas, floor cushions and marigold strings in afternoon light"), s("garden", "Garden lawn", "A garden lawn with pink and green canopies, low seating and hanging lanterns")],
    haldi: [s("courtyard", "Marigold courtyard", "A sunlit courtyard decorated with yellow marigolds, brass bowls and a mango-leaf toran"), s("home", "Home courtyard", "A home courtyard with a low wooden seat, brass bowls of turmeric and marigold garlands"), s("garden", "Sunny garden", "A sunny garden with yellow drapes, marigold strings and a flower-decorated seat")],
    sangeet: [s("stage", "Fairy-lit stage", "A night celebration stage with warm fairy lights, floral arches and instrumental musicians"), s("lawn", "Open lawn at night", "An open lawn with fairy-light canopies, a small stage and family gathered around"), s("ballroom", "Ballroom", "An elegant ballroom with chandeliers, a polished dance floor and flower arrangements")],
    wedding: [s("floral", "Flower-decorated setting", "An elegant flower-decorated ceremonial setting appropriate to the selected culture")],
    reception: [s("hall", "Chandelier hall", "A grand reception hall with chandeliers, ivory roses, hanging flowers and warm golden light"), s("poolside", "Poolside evening", "A poolside venue with floating candles, white flowers and string lights"), s("garden", "Garden evening", "A garden at night with fairy lights, white flowers and a floral arch")],
    engagement: [s("stage", "Floral stage", "An elegant banquet hall stage with a floral backdrop of white and blush roses, hanging crystal lights, soft pink drapes and warm golden lighting"), s("garden", "Garden pergola", "An open-air garden lawn at evening with a white pergola draped in sheer curtains, fairy lights, blush and ivory flowers and glowing lanterns")],
    sagan: [s("home", "Decorated home", "A warmly lit family home decorated with marigold garlands, a rangoli, brass diyas and a festive seating area"), s("hall", "Banquet hall", "A banquet hall with a low decorated seat, marigold and rose garlands and warm golden lights")],
    cocktail: [s("garden", "Garden lounge at night", "An open-air garden lounge at night with a white pergola, fairy lights strung through the trees, candle-lit tables and soft golden lighting"), s("poolside", "Poolside party", "A poolside party at night with floating candles, white lounge seating and string lights overhead"), s("lounge", "Elegant lounge", "A stylish indoor lounge with velvet seating, crystal chandeliers, tall flower arrangements and warm amber lighting")],
    baraat: [s("street", "Festive procession", "A festive wedding procession at dusk with marigold decorations, lights, a decorated white horse and the venue gate glowing in the background"), s("gate", "Venue entrance", "A grand venue entrance decorated with flowers and lights where the bride's family wait to welcome the baraat")],
  },
};

export const STYLE_WEDDING_OPTIONS = {
  "Marathi wedding": {
    outfits: {
      blessing: [o("mr-paithani", "Yellow Paithani / cream kurta", "Yellow Paithani saree with a green border, nath and gajra", "Cream silk kurta with a saffron stole"), o("mr-nauvari", "Green Nauvari / white kurta", "Green Nauvari saree with nath and a gajra", "White kurta with a maroon Nehru jacket")],
      mehndi: [o("mr-rani", "Rani-pink Paithani / white kurta", "Rani-pink Paithani saree with flower jewellery", "White kurta with a pink stole")],
      haldi: [o("mr-nauvari-yellow", "Yellow Nauvari / white kurta", "Bright yellow Nauvari saree with a flower veni and marigold jewellery", "White kurta-pyjama with a yellow stole")],
      sangeet: [o("mr-lavani", "Lavani Nauvari / black kurta", "Red-and-gold Nauvari saree in Lavani style with a gajra", "Black silk kurta with a gold Nehru jacket")],
      wedding: [o("mr-traditional", "Nauvari Paithani / dhoti-kurta and pheta", "Purple-and-green Nauvari Paithani saree, gold thushi, nath and pearl mundavalya", "White silk dhoti-kurta, saffron pheta and pearl mundavalya"), o("mr-yellow", "Yellow Paithani / ivory sherwani", "Yellow-and-green Paithani saree, nath and pearl mundavalya", "Ivory sherwani with a saffron pheta and mundavalya"), o("mr-shalu", "Red shalu / cream dhoti-kurta", "Red silk shalu saree with gold jewellery and pearl mundavalya", "Cream silk dhoti-kurta with a maroon stole and pheta")],
      reception: [o("mr-reception", "Paithani saree / navy bandhgala", "Peacock-blue Paithani saree with a gold border", "Navy blue bandhgala with a pocket square")],
    },
    settings: {
      blessing: [s("mr-mandir", "Ganpati mandir at dawn", "An old stone Ganpati mandir at dawn with diyas and marigold garlands"), s("mr-devghar", "Home devghar", "A home prayer room with a brass Ganpati idol, glowing diyas and rangoli"), s("mr-wada", "Wada courtyard", "A traditional Marathi wada courtyard with a tulsi planter, rangoli and marigolds")],
      wedding: [s("mr-mandap", "Banana-leaf mandap", "A banana-leaf and marigold mandap with brass lamps and mango-leaf torans"), s("mr-wada", "Heritage wada", "A heritage wada courtyard decorated with marigolds, rangoli and brass lamps"), s("mr-lawn", "Evening lawn mandap", "An open lawn mandap under fairy lights and marigold strings")],
    },
    actions: {
      wedding: [a("mr-antarpat", "Antarpat and akshata", "The couple stand facing each other with a silk antarpat cloth held between them. The cloth is lowered, they see each other and smile shyly as family gently shower akshata rice."), a("mr-varmala", "Exchange of garlands", "The couple face each other and gently place flower garlands around each other’s necks while family smile and shower petals.")],
    },
  },
  "Bengali wedding": {
    outfits: {
      blessing: [o("bn-garad", "Garad saree / silk panjabi", "White garad saree with a red border and shankha-pola bangles", "Cream silk panjabi with a dhoti")],
      mehndi: [o("bn-tant", "Green tant saree / cream kurta", "Bright green tant saree with flower jewellery", "Cream kurta with a green stole")],
      haldi: [o("bn-holud", "Gaye holud yellow saree / panjabi", "Yellow-and-red cotton saree with flower jewellery", "Yellow panjabi with a white dhoti")],
      sangeet: [o("bn-banarasi", "Magenta Banarasi lehenga / bandhgala", "Magenta Banarasi lehenga", "Black bandhgala with gold buttons")],
      wedding: [o("bn-traditional", "Red Banarasi / dhoti-panjabi and topor", "Red Banarasi saree, chandan dots on the forehead and shola mukut", "Ivory dhoti-panjabi and topor"), o("bn-gold", "Red Banarasi / gold panjabi", "Red Banarasi saree with gold jewellery and a red veil", "Gold silk panjabi, dhoti and topor"), o("bn-maroon", "Maroon Banarasi / ivory dhoti", "Maroon Banarasi saree with gold jewellery and shola mukut", "Ivory silk dhoti-panjabi with a red shawl")],
      reception: [o("bn-tissue", "Gold tissue saree / black bandhgala", "Gold tissue saree with a diamond necklace", "Black bandhgala with a red pocket square")],
    },
    settings: {
      blessing: [s("bn-rajbari", "Rajbari courtyard at dawn", "A Bengali rajbari courtyard at dawn with alpona patterns, brass lamps and jasmine"), s("bn-thakurghar", "Home thakurghar", "A home prayer room with alpona patterns, brass lamps and marigolds")],
      wedding: [s("bn-chhadnatala", "Rajbari chhadnatala", "A rajbari courtyard with a decorated chhadnatala canopy, alpona and brass lamps"), s("bn-hall", "Flower-filled hall", "A wedding hall decorated with white rajnigandha, red roses and brass lamps")],
    },
    actions: {
      wedding: [a("bn-shubho", "Shubho drishti", "The seated bride holds two paan leaves in front of her face, then slowly lowers them; the couple look at each other for the first time and smile shyly."), a("bn-malabadal", "Mala badal", "The couple face each other and exchange flower garlands while family cheer softly and shower petals."), a("bn-sindoor", "Sindoor daan", "The groom gently applies a little sindoor to the bride’s hair parting; she smiles with lowered eyes as family watch fondly.")],
    },
  },
  "Marwari wedding": {
    outfits: {
      blessing: [o("mw-leheriya", "Leheriya saree / bandhgala", "Leheriya saree with a gota border and bangles", "Ivory bandhgala with a leheriya safa")],
      mehndi: [o("mw-bandhani", "Bandhani ghagra / cream kurta", "Green bandhani ghagra-choli with mirror work", "Cream kurta with a bandhani safa")],
      haldi: [o("mw-peela", "Yellow poshak / white kurta", "Bright yellow Rajasthani poshak with gota work", "White kurta with a yellow safa")],
      sangeet: [o("mw-ghoomar", "Ghoomar ghagra / angrakha", "Red flared ghagra with mirror work for Ghoomar", "White angrakha kurta with a colourful safa")],
      wedding: [o("mw-traditional", "Rajasthani poshak / achkan and safa", "Embroidered Rajasthani poshak and odhni", "Ivory achkan and leheriya safa"), o("mw-red", "Red poshak / gold sherwani", "Red heavily embroidered poshak with borla and nath", "Gold sherwani with a red safa and kalgi"), o("mw-pink", "Rani-pink lehenga / ivory achkan", "Rani-pink lehenga with gota-patti work and borla", "Ivory achkan with a pink safa and pearl mala")],
      reception: [o("mw-emerald", "Emerald lehenga / black bandhgala", "Emerald green velvet lehenga with polki jewellery", "Black bandhgala with a gold brooch")],
    },
    settings: {
      blessing: [s("mw-haveli", "Sandstone haveli at dawn", "A Rajasthani sandstone haveli at dawn with carved jharokhas, bandhani drapes and brass lamps")],
      wedding: [s("mw-haveli", "Haveli mandap", "A haveli mandap with carved jharokhas, marigolds and brass lamps"), s("mw-palace", "Palace courtyard", "A Rajasthani palace courtyard with carved arches, marigolds and lanterns"), s("mw-desert", "Desert sunset mandap", "A desert-camp mandap at sunset with lanterns and bandhani drapes")],
    },
    actions: {
      wedding: [a("mw-pheras", "Pheras", "The couple walk slowly around a small sacred fire in the mandap, the bride’s odhni knotted to the groom’s stole, as elders watch with folded hands."), a("mw-varmala", "Varmala", "The couple face each other on a flower-covered platform and exchange garlands while family cheer.")],
    },
  },
  "Gujarati wedding": {
    outfits: {
      blessing: [o("gj-patola", "Patola saree / kediyu", "Red patola silk saree", "White kediyu with a colourful stole")],
      mehndi: [o("gj-chaniya", "Mirror-work chaniya choli / kediyu", "Green mirror-work chaniya choli", "Cream kediyu with a printed stole")],
      haldi: [o("gj-pithi", "Yellow bandhani / white kurta", "Yellow bandhani chaniya choli with flower jewellery", "White kurta with a yellow stole")],
      sangeet: [o("gj-garba", "Garba chaniya choli / kediyu", "Multicolour mirror-work chaniya choli", "Embroidered kediyu with a red pagh")],
      wedding: [o("gj-traditional", "Panetar and gharchola / sherwani and pagh", "Ivory-and-red panetar saree and gharchola drape", "Cream sherwani and traditional pagh"), o("gj-gharchola", "Red gharchola / ivory sherwani", "Red gharchola saree with gold checks and a veil", "Ivory sherwani with a red pagh"), o("gj-pink", "Pink lehenga / cream sherwani", "Pink lehenga with bandhani dupatta", "Cream sherwani with a pink pagh")],
      reception: [o("gj-teal", "Teal saree / grey suit", "Teal silk saree with a gold border", "Charcoal grey suit with a tie")],
    },
    settings: {
      blessing: [s("gj-courtyard", "Heritage courtyard", "A Gujarati heritage courtyard with rangoli, bandhani toran, carved wooden pillars and diyas")],
      wedding: [s("gj-mandap", "Floral mandap", "A floral mandap with marigolds, bandhani drapes and brass lamps"), s("gj-pol", "Old pol courtyard", "An old carved-wood pol courtyard decorated with torans and diyas")],
    },
    actions: {
      wedding: [a("gj-hastmelap", "Hast melap", "The bride’s parents gently join the couple’s hands beneath a draped cloth; the couple share a shy smile as family bless them."), a("gj-antarpat", "Antarpat", "A cloth held between the couple is lowered; they see each other, smile and exchange garlands.")],
    },
  },
  "Sikh wedding": {
    outfits: {
      blessing: [o("sk-pastel", "Pastel suit / kurta-pyjama", "Pastel salwar suit with a dupatta covering her head", "Cream kurta-pyjama with a matching turban"), o("sk-phulkari", "Phulkari dupatta / white kurta", "Peach salwar suit with a phulkari dupatta covering her head", "White kurta-pyjama with a navy turban")],
      mehndi: [o("sk-green", "Green Punjabi suit / kurta", "Green Punjabi suit with a phulkari dupatta", "Cream kurta with a green turban")],
      haldi: [o("sk-maiyan", "Maiyan yellow suit / white kurta", "Yellow salwar suit with flower jewellery", "White kurta-pyjama with a yellow turban")],
      sangeet: [o("sk-jaggo", "Jaggo phulkari suit / kurta with jacket", "Bright pink Punjabi suit with a phulkari dupatta", "Black kurta with a silver jacket and a pink turban")],
      wedding: [o("sk-traditional", "Embroidered suit / sherwani and turban", "Embroidered bridal salwar kameez with a head-covering dupatta", "Sherwani and turban"), o("sk-pink", "Pink lehenga / ivory sherwani", "Pink embroidered lehenga with a dupatta covering her head", "Ivory sherwani with a pink turban"), o("sk-red", "Red suit with kaleere / gold sherwani", "Red embroidered salwar kameez with a head-covering dupatta and kaleere", "Gold sherwani with a red turban")],
      reception: [o("sk-reception", "Maroon lehenga / black suit", "Maroon velvet lehenga", "Black suit with a maroon turban")],
    },
    settings: {
      blessing: [s("sk-gurdwara", "Gurdwara courtyard at dawn", "A peaceful gurdwara courtyard at dawn; the couple are modestly dressed with heads covered"), s("sk-home", "Home prayer gathering", "A peaceful home with a simple prayer gathering, white sheets and flowers")],
      wedding: [s("sk-gurdwara", "Gurdwara", "A peaceful gurdwara hall with soft light, white flowers and family seated respectfully")],
    },
    actions: {
      blessing: [a("sk-ardaas", "Family prayer", "The couple sit with family, heads covered, hands folded in quiet prayer, then share a peaceful smile.")],
      wedding: [a("sk-laavan", "Laavan", "The couple walk slowly and reverently during the laavan, the bride following the groom while holding the palla, as family sit respectfully.")],
    },
  },
  "Muslim wedding": {
    outfits: {
      blessing: [o("ms-anarkali", "Pastel anarkali / ivory kurta", "Pastel anarkali with a dupatta", "Ivory kurta-pyjama")],
      mehndi: [o("ms-sharara", "Green sharara / white kurta", "Green sharara with gota work and flower jewellery", "White kurta with a green stole")],
      haldi: [o("ms-manjha", "Manjha yellow sharara / white kurta", "Yellow sharara with flower jewellery", "White kurta-pyjama with a yellow stole")],
      sangeet: [o("ms-mint", "Mint gharara / bandhgala", "Mint green gharara with silver embroidery", "Navy bandhgala with a silver brooch")],
      wedding: [o("ms-traditional", "Embroidered sharara / ivory sherwani", "Embroidered bridal sharara and dupatta", "Ivory sherwani and traditional cap"), o("ms-red", "Red gharara / ivory sherwani", "Red embroidered gharara with a dupatta veil", "Ivory sherwani with a matching turban"), o("ms-gold", "Gold lehenga / cream sherwani", "Gold-and-ivory embroidered lehenga with a dupatta veil", "Cream sherwani with a maroon stole")],
      reception: [o("ms-walima", "Walima pastel gown / black sherwani", "Pastel pink embroidered gown with a dupatta", "Black sherwani with a white pocket square")],
    },
    settings: {
      blessing: [s("ms-courtyard", "Heritage arches courtyard", "An elegant heritage courtyard with geometric arches, lanterns and white flowers")],
      wedding: [s("ms-hall", "Floral nikah hall", "An elegant floral hall with white flowers, lanterns and soft golden light"), s("ms-arches", "Arched courtyard", "A courtyard with carved geometric arches, hanging lanterns and white roses")],
    },
    actions: {
      wedding: [a("ms-nikah", "Nikah and blessings", "The couple sit modestly while family look on; after the respectful nikah signing, elders raise their hands in blessing and the couple share a gentle smile. No Hindu wedding rituals.")],
    },
  },
  "Christian wedding": {
    outfits: {
      blessing: [o("ch-pastel", "Pastel dress / light suit", "Pastel blue midi dress", "Light beige suit with a white shirt")],
      mehndi: [o("ch-floral", "Floral dress / linen shirt", "Floral summer dress with flowers in her hair", "White linen shirt with beige trousers")],
      haldi: [o("ch-roce", "Roce whites / white shirt", "Simple white cotton dress with flowers in her hair", "White cotton shirt and trousers")],
      sangeet: [o("ch-cocktail", "Cocktail dress / blazer", "Sparkling navy cocktail dress", "Black blazer with a white shirt")],
      wedding: [o("ch-traditional", "White gown and veil / formal suit", "White wedding gown and veil", "Tailored formal suit"), o("ch-saree", "White saree and veil / black suit", "White silk saree with a lace veil", "Black suit with a white shirt and bow tie"), o("ch-lace", "Lace gown / navy suit", "Ivory lace gown with a long veil", "Navy blue suit with a white rose boutonniere")],
      reception: [o("ch-ballgown", "Blush ballgown / black tuxedo", "Blush pink ballgown", "Black tuxedo with a bow tie")],
    },
    settings: {
      blessing: [s("ch-church", "Sunlit church exterior", "A sunlit church exterior and a garden walkway with white roses and soft morning light")],
      wedding: [s("ch-church", "Flower-decorated church", "A flower-decorated church with white roses along the aisle and soft light through stained glass"), s("ch-garden", "Garden ceremony", "An outdoor garden ceremony with white chairs, a floral arch and soft afternoon light"), s("ch-beach", "Beach ceremony", "A beach ceremony with a white floral arch, gentle waves and golden light")],
    },
    actions: {
      wedding: [a("ch-rings", "Exchange of rings", "At the altar, the couple face each other and exchange rings with gentle smiles as guests watch warmly."), a("ch-aisle", "Walk down the aisle", "The bride walks slowly down a flower-lined aisle towards the groom, who turns and smiles at her emotionally.")],
    },
  },
};

export function styleWeddingOptions(style) {
  return STYLE_WEDDING_OPTIONS[style] || STYLE_WEDDING_OPTIONS["Marathi wedding"];
}
