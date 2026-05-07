// 《史记·项羽本纪》 — Annotated chapter data with historical geography
// Each chapter represents a narrative episode with original text, translation,
// entity tagging (places/persons/events), and map state (territories, routes, POIs).
// Based on 中华书局点校本《史记》卷七 项羽本纪.

export const book = {
  id: 'xiangyu',
  title: '项羽本纪',
  bookSeries: '史记',
  dynasty: '西汉',
  author: '司马迁',
  era: { start: -232, end: -202 }, // 项羽生卒
  description: '《史记》卷七，记西楚霸王项籍一生。自起兵反秦至乌江自刎，凡三十载。',
};

// Period boundaries (state polygons per era)
// Hand-traced from 谭其骧《中国历史地图集》第二册 战国/秦/楚汉之际

// Chapters — full 项羽本纪, divided by narrative episode
export const chapters = [
  {
    id: 'origin',
    title: '少年起家',
    subtitle: '项氏之兴',
    year: -222,
    period: 'warring_late',
    paragraphs: [
      {
        id: 'p1',
        original: '项籍者，下相人也，字羽。初起时，年二十四。其季父项梁，梁父即楚将项燕，为秦将王翦所戮者也。项氏世世为楚将，封于项，故姓项氏。',
        translation: '项籍是下相人，字羽。起兵时年二十四岁。他的叔父项梁，项梁的父亲就是楚国将领项燕——被秦将王翦所杀的那位。项氏世代为楚将，封地在项，所以以项为姓。',
        entities: [
          { text: '项籍', type: 'person', description: '即项羽，名籍字羽' },
          { text: '下相', type: 'place', modernName: '今江苏宿迁西南', lat: 33.96, lng: 118.28, poi: 'royal', description: '项羽故里' },
          { text: '项梁', type: 'person', description: '项羽叔父，起兵主事' },
          { text: '项燕', type: 'person', description: '楚国大将，秦灭楚时战死' },
          { text: '王翦', type: 'person', description: '秦国名将，灭楚主帅' },
          { text: '项', type: 'place', modernName: '今河南项城', lat: 33.46, lng: 114.88, poi: 'city', description: '项氏封邑' },
        ],
        routes: [],
      },
      {
        id: 'p2',
        original: '项籍少时，学书不成，去学剑，又不成。项梁怒之。籍曰：「书足以记名姓而已。剑一人敌，不足学，学万人敌。」于是项梁乃教籍兵法，籍大喜，略知其意，又不肯竟学。',
        translation: '项籍年少时，学读书写字没学成，又学剑术，也没学成。项梁责怪他。项籍说：「读书识字足以记姓名罢了。剑术只能敌一人，不值得学，要学万人敌的本事。」于是项梁就教他兵法，项籍大为高兴，但只大略明白其要旨，又不肯钻研到底。',
        entities: [
          { text: '项籍', type: 'person', description: '项羽' },
          { text: '项梁', type: 'person', description: '项羽叔父' },
          { text: '万人敌', type: 'event', description: '项羽志向，喻指统兵之术' },
        ],
        routes: [],
      },
    ],
  },
  {
    id: 'qin_emperor',
    title: '观秦皇帝',
    subtitle: '彼可取而代也',
    year: -210,
    period: 'qin_end',
    paragraphs: [
      {
        id: 'p1',
        original: '秦始皇帝游会稽，渡浙江，梁与籍俱观。籍曰：「彼可取而代也。」梁掩其口，曰：「毋妄言，族矣！」梁以此奇籍。籍长八尺余，力能扛鼎，才气过人，虽吴中子弟皆已惮籍矣。',
        translation: '秦始皇巡游会稽，渡过浙江，项梁和项籍一同观看。项籍说：「那个皇帝可以取而代之。」项梁急忙捂住他的嘴，说：「别胡说，要灭族的！」但项梁因此感到项籍非同寻常。项籍身高八尺有余，力能举鼎，才气过人，连吴中的青年子弟都已敬畏他。',
        entities: [
          { text: '秦始皇', type: 'person', description: '嬴政，秦帝国开创者' },
          { text: '会稽', type: 'place', modernName: '今浙江绍兴', lat: 30.00, lng: 120.57, poi: 'city', description: '秦末项氏避居地' },
          { text: '浙江', type: 'place', modernName: '今钱塘江', lat: 30.20, lng: 120.10, poi: 'pass', description: '钱塘江' },
          { text: '项梁', type: 'person', description: '项羽叔父' },
          { text: '项籍', type: 'person', description: '项羽' },
          { text: '吴中', type: 'place', modernName: '今江苏苏州', lat: 31.30, lng: 120.60, poi: 'city', description: '项氏寓居之地' },
          { text: '彼可取而代也', type: 'event', description: '项羽豪言，气吞天下' },
        ],
        routes: [
          { name: '秦始皇南巡', faction: '秦', color: '#6B3F1D',
            points: [
              { lat: 34.34, lng: 108.71, label: '咸阳' },
              { lat: 34.62, lng: 112.45, label: '洛阳' },
              { lat: 32.05, lng: 118.78, label: '丹阳' },
              { lat: 30.20, lng: 120.10, label: '渡浙江' },
              { lat: 30.00, lng: 120.57, label: '会稽' },
            ] },
        ],
      },
    ],
  },
  {
    id: 'huiji_uprising',
    title: '会稽起兵',
    subtitle: '杀殷通举吴中',
    year: -209,
    period: 'qin_end',
    paragraphs: [
      {
        id: 'p1',
        original: '秦二世元年七月，陈涉等起大泽中。其九月，会稽守通谓梁曰：「江西皆反，此亦天亡秦之时也。吾闻先即制人，后则为人所制。吾欲发兵，使公及桓楚将。」',
        translation: '秦二世元年七月，陈胜等人在大泽乡起义。这年九月，会稽郡守殷通对项梁说：「江西各地都已反秦，这也是上天要灭秦的时候。我听说先发制人，后则受制于人。我打算发兵，请您和桓楚为将。」',
        entities: [
          { text: '陈涉', type: 'person', description: '陈胜，秦末起义首领' },
          { text: '大泽', type: 'place', modernName: '今安徽宿州', lat: 33.31, lng: 117.10, poi: 'battle', description: '陈胜吴广起义之地' },
          { text: '会稽', type: 'place', modernName: '今浙江绍兴', lat: 30.00, lng: 120.57, poi: 'city', description: '会稽郡' },
          { text: '通', type: 'person', description: '会稽郡守殷通' },
          { text: '项梁', type: 'person', description: '项羽叔父' },
          { text: '桓楚', type: 'person', description: '楚地豪杰' },
        ],
        routes: [
          { name: '陈胜起义', faction: '楚', color: '#C41E24',
            points: [
              { lat: 33.31, lng: 117.10, label: '大泽乡' },
              { lat: 33.74, lng: 114.65, label: '陈' },
            ] },
        ],
      },
      {
        id: 'p2',
        original: '梁乃召故所知豪吏，谕以所为起大事，遂举吴中兵。使人收下县，得精兵八千人。梁部署吴中豪杰为校尉、候、司马。',
        translation: '项梁于是召集旧识的豪杰官吏，告诉他们要起兵谋大事的缘由，就在吴中起兵。派人征集下属各县的兵员，得到精兵八千人。项梁部署吴中豪杰，分别担任校尉、候、司马。',
        entities: [
          { text: '项梁', type: 'person', description: '项羽叔父' },
          { text: '吴中', type: 'place', modernName: '今江苏苏州', lat: 31.30, lng: 120.60, poi: 'royal', description: '项氏起兵地' },
          { text: '八千精兵', type: 'event', description: '项氏起家兵力' },
        ],
        routes: [
          { name: '项梁举吴中', faction: '楚', color: '#C41E24',
            points: [
              { lat: 31.30, lng: 120.60, label: '吴中' },
              { lat: 32.07, lng: 118.78, label: '丹阳' },
              { lat: 32.94, lng: 118.49, label: '广陵' },
            ] },
        ],
      },
    ],
  },
  {
    id: 'cross_river',
    title: '渡江北上',
    subtitle: '收陈婴英布',
    year: -208,
    period: 'qin_end',
    paragraphs: [
      {
        id: 'p1',
        original: '项梁渡淮，黥布、蒲将军亦以兵属焉。凡六七万人，军下邳。当是时，秦嘉已立景驹为楚王，军彭城东，欲距项梁。',
        translation: '项梁渡过淮河北上，黥布、蒲将军也率兵归附。共六七万人，驻军于下邳。当时，秦嘉已立景驹为楚王，驻军彭城以东，想抗拒项梁。',
        entities: [
          { text: '项梁', type: 'person', description: '项羽叔父' },
          { text: '淮', type: 'place', modernName: '今淮河', lat: 33.10, lng: 117.50, poi: 'pass', description: '淮河' },
          { text: '黥布', type: 'person', description: '英布，秦末名将' },
          { text: '下邳', type: 'place', modernName: '今江苏邳州', lat: 34.31, lng: 117.95, poi: 'city', description: '楚军驻地' },
          { text: '秦嘉', type: 'person', description: '秦末起义将领' },
          { text: '景驹', type: 'person', description: '楚王后裔' },
          { text: '彭城', type: 'place', modernName: '今江苏徐州', lat: 34.27, lng: 117.18, poi: 'capital', description: '楚故都' },
        ],
        routes: [
          { name: '项梁北渡', faction: '楚', color: '#C41E24',
            points: [
              { lat: 32.07, lng: 118.78, label: '渡江' },
              { lat: 33.20, lng: 119.00, label: '渡淮' },
              { lat: 34.31, lng: 117.95, label: '下邳' },
            ] },
        ],
      },
    ],
  },
  {
    id: 'julu',
    title: '巨鹿之战',
    subtitle: '破釜沉舟',
    year: -207,
    period: 'qin_end',
    paragraphs: [
      {
        id: 'p1',
        original: '项羽乃悉引兵渡河，皆沉船，破釜甑，烧庐舍，持三日粮，以示士卒必死，无一还心。于是至则围王离，与秦军遇，九战，绝其甬道，大破之，杀苏角，虏王离。',
        translation: '项羽于是率全军渡过漳河，凿沉所有船只，砸碎炊具，烧毁营房，只携带三天口粮，向士卒表明必死决心，断绝一切退路。到达后包围秦将王离，与秦军交战，九次激战，切断秦军粮道，大破之，斩杀苏角，俘获王离。',
        entities: [
          { text: '项羽', type: 'person', description: '西楚霸王' },
          { text: '河', type: 'place', modernName: '今漳河', lat: 36.32, lng: 114.65, poi: 'pass', description: '漳河，破釜沉舟之处' },
          { text: '王离', type: 'person', description: '秦军主将' },
          { text: '苏角', type: 'person', description: '秦军副将' },
          { text: '甬道', type: 'event', description: '秦军运粮的夹道' },
          { text: '破釜沉舟', type: 'event', description: '决死一战' },
        ],
        routes: [
          { name: '项羽渡河', faction: '楚', color: '#C41E24',
            points: [
              { lat: 35.55, lng: 116.55, label: '彭城' },
              { lat: 36.05, lng: 115.20, label: '安阳' },
              { lat: 36.32, lng: 114.65, label: '漳河' },
              { lat: 37.07, lng: 115.05, label: '巨鹿' },
            ] },
          { name: '秦军甬道', faction: '秦', color: '#6B3F1D', dashed: true,
            points: [
              { lat: 38.04, lng: 114.50, label: '章邯营' },
              { lat: 37.07, lng: 115.05, label: '巨鹿' },
            ] },
        ],
      },
      {
        id: 'p2',
        original: '当是时，楚兵冠诸侯。诸侯军救巨鹿下者十余壁，莫敢纵兵。及楚击秦，诸将皆从壁上观。楚战士无不一以当十，楚兵呼声动天，诸侯军无不人人惴恐。',
        translation: '当时，楚军威震诸侯。前来援救巨鹿的诸侯军共有十余座壁垒，无人敢出兵迎战。等到楚军攻击秦军，诸将都在壁垒上观望。楚军将士无不以一当十，呐喊声震天动地，诸侯军中人人胆战心惊。',
        entities: [
          { text: '巨鹿', type: 'place', modernName: '今河北平乡西南', lat: 37.07, lng: 115.05, poi: 'battle', description: '项羽大破秦军处' },
          { text: '诸侯军', type: 'person', description: '各路反秦诸侯军' },
          { text: '一以当十', type: 'event', description: '楚军勇悍' },
        ],
        routes: [],
      },
      {
        id: 'p3',
        original: '于是已破秦军，项羽召见诸侯将。入辕门，无不膝行而前，莫敢仰视。项羽由是始为诸侯上将军，诸侯皆属焉。',
        translation: '楚军击破秦军后，项羽召见各诸侯将领。他们走入军门，无不跪着前行，无人敢抬头仰视。项羽从此成为诸侯的上将军，各诸侯都归他统辖。',
        entities: [
          { text: '项羽', type: 'person', description: '楚军主帅' },
          { text: '辕门', type: 'event', description: '军营大门' },
          { text: '上将军', type: 'event', description: '诸侯联军总帅' },
        ],
        routes: [],
      },
    ],
  },
  {
    id: 'hongmen',
    title: '鸿门之宴',
    subtitle: '项庄舞剑意在沛公',
    year: -206,
    period: 'chu_han_18',
    paragraphs: [
      {
        id: 'p1',
        original: '楚军行略定秦地。函谷关有兵守关，不得入。又闻沛公已破咸阳，项羽大怒，使当阳君等击关。项羽遂入，至于戏西。沛公军霸上，未得与项羽相见。',
        translation: '楚军一路攻取秦地。到函谷关时有军队守关，无法进入。又听说沛公(刘邦)已攻破咸阳，项羽大怒，派当阳君等人攻打函谷关。项羽于是入关，到达戏水西岸。沛公驻军霸上，未能与项羽相见。',
        entities: [
          { text: '函谷关', type: 'place', modernName: '今河南灵宝', lat: 34.52, lng: 110.87, poi: 'pass', description: '关中东大门' },
          { text: '沛公', type: 'person', description: '刘邦' },
          { text: '咸阳', type: 'place', modernName: '今陕西咸阳', lat: 34.34, lng: 108.71, poi: 'capital', description: '秦故都' },
          { text: '项羽', type: 'person', description: '西楚霸王' },
          { text: '戏', type: 'place', modernName: '今陕西临潼东', lat: 34.36, lng: 109.21, poi: 'battle', description: '项羽屯军处' },
          { text: '霸上', type: 'place', modernName: '今陕西西安东', lat: 34.27, lng: 109.05, poi: 'battle', description: '刘邦屯军处' },
        ],
        routes: [
          { name: '项羽入关', faction: '楚', color: '#C41E24',
            points: [
              { lat: 35.30, lng: 113.30, label: '河内' },
              { lat: 34.78, lng: 113.21, label: '渑池' },
              { lat: 34.52, lng: 110.87, label: '函谷关' },
              { lat: 34.36, lng: 109.21, label: '戏西' },
            ] },
          { name: '刘邦先入', faction: '汉', color: '#2B4490', dashed: true,
            points: [
              { lat: 33.74, lng: 114.65, label: '南阳' },
              { lat: 33.10, lng: 110.65, label: '武关' },
              { lat: 34.27, lng: 109.05, label: '霸上' },
              { lat: 34.34, lng: 108.71, label: '咸阳' },
            ] },
        ],
      },
      {
        id: 'p2',
        original: '沛公旦日从百余骑来见项王，至鸿门，谢曰：「臣与将军戮力而攻秦，将军战河北，臣战河南，然不自意能先入关破秦，得复见将军于此。今者有小人之言，令将军与臣有郤。」',
        translation: '沛公第二天带着百余骑兵来见项王，到达鸿门，谢罪说：「我与将军合力攻秦，将军在黄河以北作战，我在黄河以南作战，但没料到能先入函谷关攻破秦军，又能在此处再见将军。如今有小人之言，使将军与我之间产生隔阂。」',
        entities: [
          { text: '沛公', type: 'person', description: '刘邦' },
          { text: '项王', type: 'person', description: '项羽' },
          { text: '鸿门', type: 'place', modernName: '今陕西临潼新丰镇', lat: 34.42, lng: 109.21, poi: 'battle', description: '鸿门宴之地' },
          { text: '河北', type: 'place', modernName: '黄河以北', lat: 36.50, lng: 114.50, poi: 'pass', description: '项羽战场' },
          { text: '河南', type: 'place', modernName: '黄河以南', lat: 33.50, lng: 113.50, poi: 'pass', description: '刘邦战场' },
        ],
        routes: [
          { name: '沛公赴宴', faction: '汉', color: '#2B4490',
            points: [
              { lat: 34.27, lng: 109.05, label: '霸上' },
              { lat: 34.42, lng: 109.21, label: '鸿门' },
            ] },
        ],
      },
      {
        id: 'p3',
        original: '项王、项伯东向坐；亚父南向坐——亚父者，范增也；沛公北向坐；张良西向侍。范增数目项王，举所佩玉玦以示之者三，项王默然不应。范增起，出召项庄，谓曰：「君王为人不忍。若入前为寿，寿毕，请以剑舞，因击沛公于坐，杀之。」',
        translation: '项王、项伯朝东坐；亚父朝南坐——亚父就是范增；沛公朝北坐；张良朝西陪侍。范增多次以目示意项王，三次举起佩戴的玉玦暗示项王下决心，项王默然不答。范增起身，出去召来项庄，说：「君王为人不忍下手。你进去上前敬酒，敬酒完毕，请求舞剑助兴，趁机在席上击杀沛公。」',
        entities: [
          { text: '项王', type: 'person', description: '项羽' },
          { text: '项伯', type: 'person', description: '项羽叔父' },
          { text: '亚父', type: 'person', description: '范增，项羽谋主' },
          { text: '范增', type: 'person', description: '楚军军师' },
          { text: '沛公', type: 'person', description: '刘邦' },
          { text: '张良', type: 'person', description: '汉军谋士' },
          { text: '项庄', type: 'person', description: '项羽堂弟' },
          { text: '项庄舞剑', type: 'event', description: '杀机暗藏' },
        ],
        routes: [],
      },
    ],
  },
  {
    id: 'feudal',
    title: '分封诸侯',
    subtitle: '十八诸侯',
    year: -206,
    period: 'chu_han_18',
    paragraphs: [
      {
        id: 'p1',
        original: '项王、范增疑沛公之有天下，业已讲解，又恶负约，恐诸侯叛之，乃阴谋曰：「巴、蜀道险，秦之迁人皆居蜀。」乃曰：「巴、蜀亦关中地也。」故立沛公为汉王，王巴、蜀、汉中，都南郑。',
        translation: '项王、范增怀疑沛公有夺取天下之心，但已经和解，又不愿背弃盟约，怕诸侯背叛，于是密谋说：「巴、蜀道路险阻，秦时的迁徙者都住在蜀地。」就对外说：「巴、蜀也是关中之地。」所以立沛公为汉王，统治巴、蜀、汉中，建都南郑。',
        entities: [
          { text: '项王', type: 'person', description: '项羽' },
          { text: '范增', type: 'person', description: '项羽谋主' },
          { text: '沛公', type: 'person', description: '刘邦' },
          { text: '巴', type: 'place', modernName: '今重庆一带', lat: 29.56, lng: 106.55, poi: 'city', description: '巴郡' },
          { text: '蜀', type: 'place', modernName: '今四川', lat: 30.67, lng: 104.07, poi: 'city', description: '蜀郡' },
          { text: '汉中', type: 'place', modernName: '今陕西汉中', lat: 33.07, lng: 107.02, poi: 'city', description: '汉水上游' },
          { text: '南郑', type: 'place', modernName: '今陕西汉中', lat: 33.06, lng: 107.02, poi: 'capital', description: '汉国都' },
          { text: '汉王', type: 'event', description: '刘邦受封' },
        ],
        routes: [],
      },
      {
        id: 'p2',
        original: '而三分关中，王秦降将以距塞汉王。项王乃立章邯为雍王，王咸阳以西，都废丘。长史欣者，故为栎阳狱掾，尝有德於项梁，立司马欣为塞王，王咸阳以东至河，都栎阳。立董翳为翟王，王上郡，都高奴。',
        translation: '又把关中分为三部分，封秦的降将为王以阻挡汉王。项王立章邯为雍王，统治咸阳以西，建都废丘。长史司马欣，曾任栎阳狱吏，曾对项梁有恩，立司马欣为塞王，统治咸阳以东直到黄河，建都栎阳。立董翳为翟王，统治上郡，建都高奴。',
        entities: [
          { text: '章邯', type: 'person', description: '秦降将，封雍王' },
          { text: '废丘', type: 'place', modernName: '今陕西兴平', lat: 34.30, lng: 108.49, poi: 'capital', description: '雍国都' },
          { text: '司马欣', type: 'person', description: '秦降将，封塞王' },
          { text: '栎阳', type: 'place', modernName: '今陕西西安东', lat: 34.65, lng: 109.20, poi: 'capital', description: '塞国都' },
          { text: '董翳', type: 'person', description: '秦降将，封翟王' },
          { text: '上郡', type: 'place', modernName: '今陕西延安', lat: 36.59, lng: 109.49, poi: 'city', description: '翟国地' },
          { text: '高奴', type: 'place', modernName: '今陕西延安东北', lat: 36.69, lng: 109.65, poi: 'capital', description: '翟国都' },
          { text: '三分关中', type: 'event', description: '三秦封建' },
        ],
        routes: [],
      },
    ],
  },
  {
    id: 'pengcheng',
    title: '彭城之败',
    subtitle: '汉王东征',
    year: -205,
    period: 'chu_han_war',
    paragraphs: [
      {
        id: 'p1',
        original: '汉之二年冬，项羽遂北至城阳，田荣亦将兵会战。田荣不胜，走至平原，平原民杀之。遂北烧夷齐城郭室屋，皆坑田荣降卒，系虏其老弱妇女。',
        translation: '汉二年冬，项羽北上到达城阳，田荣也率军迎战。田荣战败，逃到平原，被平原百姓所杀。项羽于是北上焚烧夷平齐国的城郭房屋，将田荣降兵全部活埋，系拘其老弱妇女。',
        entities: [
          { text: '项羽', type: 'person', description: '西楚霸王' },
          { text: '城阳', type: 'place', modernName: '今山东菏泽东北', lat: 35.65, lng: 115.50, poi: 'battle', description: '齐楚交战处' },
          { text: '田荣', type: 'person', description: '齐国反楚领袖' },
          { text: '平原', type: 'place', modernName: '今山东平原', lat: 37.17, lng: 116.43, poi: 'city', description: '田荣败死处' },
        ],
        routes: [
          { name: '项羽伐齐', faction: '楚', color: '#C41E24',
            points: [
              { lat: 34.27, lng: 117.18, label: '彭城' },
              { lat: 35.65, lng: 115.50, label: '城阳' },
              { lat: 37.17, lng: 116.43, label: '平原' },
            ] },
        ],
      },
      {
        id: 'p2',
        original: '春，汉王部五诸侯兵，凡五十六万人，东伐楚。项王闻之，即令诸将击齐，而自以精兵三万人南从鲁出胡陵。四月，汉皆已入彭城，收其货宝美人，日置酒高会。',
        translation: '春天，汉王部署五位诸侯的军队，共五十六万人，东伐楚国。项王听到消息，立即命令众将攻齐，自己率精兵三万人从鲁地南下到胡陵。四月，汉军已全部进入彭城，收掠其财货美女，每日设酒大宴。',
        entities: [
          { text: '汉王', type: 'person', description: '刘邦' },
          { text: '五十六万', type: 'event', description: '汉军大举东征' },
          { text: '项王', type: 'person', description: '项羽' },
          { text: '鲁', type: 'place', modernName: '今山东曲阜', lat: 35.60, lng: 116.99, poi: 'city', description: '鲁地' },
          { text: '胡陵', type: 'place', modernName: '今山东鱼台东南', lat: 34.99, lng: 116.65, poi: 'city', description: '楚军南下经此' },
          { text: '彭城', type: 'place', modernName: '今江苏徐州', lat: 34.27, lng: 117.18, poi: 'capital', description: '西楚都城，被汉军攻陷' },
        ],
        routes: [
          { name: '汉王东征', faction: '汉', color: '#2B4490',
            points: [
              { lat: 34.65, lng: 109.20, label: '栎阳' },
              { lat: 34.78, lng: 113.21, label: '成皋' },
              { lat: 34.79, lng: 113.38, label: '荥阳' },
              { lat: 34.27, lng: 117.18, label: '彭城' },
            ] },
          { name: '项王回援', faction: '楚', color: '#C41E24',
            points: [
              { lat: 37.17, lng: 116.43, label: '齐地' },
              { lat: 35.60, lng: 116.99, label: '鲁' },
              { lat: 34.99, lng: 116.65, label: '胡陵' },
              { lat: 34.27, lng: 117.18, label: '彭城' },
            ] },
        ],
      },
    ],
  },
  {
    id: 'standoff',
    title: '荥阳对峙',
    subtitle: '广武之约',
    year: -203,
    period: 'chu_han_war',
    paragraphs: [
      {
        id: 'p1',
        original: '楚汉久相持未决，丁壮苦军旅，老弱罢转漕。项王谓汉王曰：「天下匈匈数岁者，徒以吾两人耳。愿与汉王挑战决雌雄，毋徒苦天下之民父子为也。」汉王笑谢曰：「吾宁斗智，不能斗力。」',
        translation: '楚汉长期相持不下，壮丁苦于军旅，老弱疲于运输。项王对汉王说：「天下纷扰多年，只是因为我们两人罢了。愿与汉王决斗一胜负，不要再让天下百姓父子受苦了。」汉王笑着回绝：「我宁愿斗智，不能斗力。」',
        entities: [
          { text: '项王', type: 'person', description: '项羽' },
          { text: '汉王', type: 'person', description: '刘邦' },
          { text: '广武', type: 'place', modernName: '今河南荥阳东北', lat: 34.85, lng: 113.40, poi: 'pass', description: '楚汉对垒之处' },
          { text: '挑战决雌雄', type: 'event', description: '项羽欲单挑' },
        ],
        routes: [],
      },
      {
        id: 'p2',
        original: '项王乃与汉王约，中分天下，割鸿沟以西者为汉，鸿沟而东者为楚。项王已约，乃引兵解而东归。',
        translation: '项王于是与汉王约定，平分天下，以鸿沟为界，鸿沟以西归汉，鸿沟以东归楚。项王约定后，就率军解围向东返回。',
        entities: [
          { text: '项王', type: 'person', description: '项羽' },
          { text: '汉王', type: 'person', description: '刘邦' },
          { text: '鸿沟', type: 'place', modernName: '今河南荥阳贾鲁河', lat: 34.79, lng: 113.38, poi: 'pass', description: '楚汉分界' },
          { text: '中分天下', type: 'event', description: '楚汉鸿沟之约' },
        ],
        routes: [
          { name: '楚军东归', faction: '楚', color: '#C41E24', dashed: true,
            points: [
              { lat: 34.85, lng: 113.40, label: '广武' },
              { lat: 34.27, lng: 117.18, label: '彭城' },
            ] },
        ],
      },
    ],
  },
  {
    id: 'gaixia',
    title: '垓下之围',
    subtitle: '四面楚歌',
    year: -202,
    period: 'chu_han_war',
    paragraphs: [
      {
        id: 'p1',
        original: '项王军壁垓下，兵少食尽，汉军及诸侯兵围之数重。夜闻汉军四面皆楚歌，项王乃大惊曰：「汉皆已得楚乎？是何楚人之多也！」',
        translation: '项王在垓下扎营，兵少粮尽，汉军及各诸侯军重重包围。夜里听到汉军四面唱起楚地歌谣，项王大惊道：「汉军已尽得楚地了吗？为何楚人这么多！」',
        entities: [
          { text: '项王', type: 'person', description: '项羽' },
          { text: '垓下', type: 'place', modernName: '今安徽灵璧东南', lat: 33.40, lng: 117.55, poi: 'battle', description: '项羽末路' },
          { text: '四面楚歌', type: 'event', description: '汉军心理战' },
        ],
        routes: [
          { name: '汉军合围', faction: '汉', color: '#2B4490',
            points: [
              { lat: 34.30, lng: 116.80, label: '汉军主力' },
              { lat: 33.40, lng: 117.55, label: '垓下' },
            ] },
          { name: '韩信南下', faction: '汉', color: '#2B4490',
            points: [
              { lat: 36.50, lng: 116.50, label: '齐地' },
              { lat: 33.40, lng: 117.55, label: '垓下' },
            ] },
          { name: '彭越东进', faction: '汉', color: '#2B4490',
            points: [
              { lat: 35.00, lng: 115.00, label: '梁地' },
              { lat: 33.40, lng: 117.55, label: '垓下' },
            ] },
        ],
      },
      {
        id: 'p2',
        original: '项王则夜起，饮帐中。有美人名虞，常幸从；骏马名骓，常骑之。于是项王乃悲歌慷慨，自为诗曰：「力拔山兮气盖世，时不利兮骓不逝。骓不逝兮可奈何，虞兮虞兮奈若何！」歌数阕，美人和之。项王泣数行下，左右皆泣，莫能仰视。',
        translation: '项王于是夜起，在帐中饮酒。有一美人名叫虞，常受宠侍从；有一骏马名叫骓，常骑乘。于是项王悲歌慷慨，自作诗道：「力能拔山啊气盖世，时机不利啊骓马不前。骓马不前啊我能怎办，虞姬虞姬啊该如何待你！」唱了数遍，美人和之。项王泪流数行，左右侍者皆泣，无人能抬头仰望。',
        entities: [
          { text: '项王', type: 'person', description: '项羽' },
          { text: '虞', type: 'person', description: '虞姬' },
          { text: '骓', type: 'person', description: '项羽坐骑' },
          { text: '力拔山兮气盖世', type: 'event', description: '垓下歌' },
        ],
        routes: [],
      },
    ],
  },
  {
    id: 'wujiang',
    title: '乌江自刎',
    subtitle: '天亡我也',
    year: -202,
    period: 'chu_han_war',
    paragraphs: [
      {
        id: 'p1',
        original: '于是项王乃上马骑，麾下壮士骑从者八百余人，直夜溃围南出，驰走。平明，汉军乃觉之，令骑将灌婴以五千骑追之。项王渡淮，骑能属者百余人耳。',
        translation: '于是项王上马，麾下壮士骑兵跟随者八百余人，在深夜冲破包围南下，飞驰而去。天亮时，汉军才察觉，命令骑将灌婴率五千骑兵追击。项王渡过淮河，能跟上的骑兵只剩百余人。',
        entities: [
          { text: '项王', type: 'person', description: '项羽' },
          { text: '灌婴', type: 'person', description: '汉军骑将' },
          { text: '淮', type: 'place', modernName: '今淮河', lat: 33.10, lng: 117.50, poi: 'pass', description: '淮河' },
        ],
        routes: [
          { name: '项王突围', faction: '楚', color: '#C41E24',
            points: [
              { lat: 33.40, lng: 117.55, label: '垓下' },
              { lat: 33.10, lng: 117.50, label: '渡淮' },
              { lat: 32.30, lng: 118.10, label: '阴陵' },
            ] },
        ],
      },
      {
        id: 'p2',
        original: '项王至阴陵，迷失道，问一田父，田父绐曰「左」。左，乃陷大泽中。以故汉追及之。项王乃复引兵而东，至东城，乃有二十八骑。汉骑追者数千人。',
        translation: '项王到达阴陵，迷失道路，问一农夫，农夫骗他说「向左」。向左，结果陷入大泽中。因此汉军追上了他。项王于是又率兵向东，到达东城时，只剩二十八骑。汉军骑兵追击者有数千人。',
        entities: [
          { text: '项王', type: 'person', description: '项羽' },
          { text: '阴陵', type: 'place', modernName: '今安徽定远', lat: 32.52, lng: 117.69, poi: 'pass', description: '项羽迷道处' },
          { text: '东城', type: 'place', modernName: '今安徽定远东南', lat: 32.34, lng: 117.85, poi: 'pass', description: '项羽剩二十八骑处' },
          { text: '田父', type: 'person', description: '诳项羽之老农' },
          { text: '迷失道', type: 'event', description: '陷大泽中' },
        ],
        routes: [
          { name: '项王迷道', faction: '楚', color: '#C41E24', dashed: true,
            points: [
              { lat: 32.30, lng: 118.10, label: '阴陵' },
              { lat: 32.34, lng: 117.85, label: '东城' },
            ] },
        ],
      },
      {
        id: 'p3',
        original: '于是项王乃欲东渡乌江。乌江亭长檥船待，谓项王曰：「江东虽小，地方千里，众数十万人，亦足王也。愿大王急渡。今独臣有船，汉军至，无以渡。」项王笑曰：「天之亡我，我何渡为！且籍与江东子弟八千人渡江而西，今无一人还，纵江东父兄怜而王我，我何面目见之？纵彼不言，籍独不愧于心乎？」',
        translation: '于是项王打算向东渡过乌江。乌江亭长撑船等候，对项王说：「江东虽小，方圆千里，民众数十万，也足以称王。请大王急渡。如今只有我有船，汉军到时，无法渡江。」项王笑道：「上天要灭亡我，我还渡江干什么！何况我项籍与江东子弟八千人渡江西征，如今无一人生还，纵使江东父兄怜悯而立我为王，我有何颜面见他们？即使他们不说，我项籍独不愧于心吗？」',
        entities: [
          { text: '项王', type: 'person', description: '项羽' },
          { text: '乌江', type: 'place', modernName: '今安徽和县东北', lat: 31.72, lng: 118.42, poi: 'pass', description: '项羽自刎处' },
          { text: '亭长', type: 'person', description: '乌江亭长' },
          { text: '江东', type: 'place', modernName: '今江苏南部', lat: 31.30, lng: 120.60, poi: 'city', description: '项氏故乡' },
          { text: '八千子弟', type: 'event', description: '当年渡江西征之兵' },
          { text: '天之亡我', type: 'event', description: '项羽末言' },
        ],
        routes: [
          { name: '项王末路', faction: '楚', color: '#C41E24',
            points: [
              { lat: 32.34, lng: 117.85, label: '东城' },
              { lat: 31.72, lng: 118.42, label: '乌江' },
            ] },
        ],
      },
    ],
  },
];

// Era timeline events (matched to chapters)
export const eraEvents = [
  { year: -209, label: '大泽乡起义', chapter: 'huiji_uprising' },
  { year: -207, label: '巨鹿之战', chapter: 'julu' },
  { year: -206, label: '鸿门宴', chapter: 'hongmen' },
  { year: -206, label: '十八诸侯', chapter: 'feudal' },
  { year: -205, label: '彭城之战', chapter: 'pengcheng' },
  { year: -203, label: '鸿沟之约', chapter: 'standoff' },
  { year: -202, label: '垓下之围', chapter: 'gaixia' },
  { year: -202, label: '乌江自刎', chapter: 'wujiang' },
];
