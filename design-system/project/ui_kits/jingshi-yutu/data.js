// 经史舆图 sample data — 3 books with chapters featuring entities, routes, territories.
// Coordinates are loose, hand-placed lat/lng values used to position markers on the
// SVG map. Not meant for cartographic accuracy.

window.JSY_DATA = {
  // Time-axis anchor years
  eraEvents: [
    { year: -632, label: "城濮之战", chapter: "chengpu" },
    { year: -627, label: "崤之战", chapter: "yao" },
    { year: -221, label: "秦统一六国", chapter: "qinunify" },
    { year: -207, label: "巨鹿之战", chapter: "julu" },
    { year: -202, label: "垓下之围", chapter: "gaixia" },
  ],

  books: [
    {
      id: "zuozhuan",
      title: "左传",
      dynasty: "春秋",
      author: "左丘明 传",
      chapters: [
        {
          id: "chengpu",
          title: "城濮之战",
          subtitle: "僖公二十八年",
          year: -632,
          paragraphs: [
            {
              id: "p1",
              original: "晋侯、宋公、齐国归父、崔夭、秦小子憖次于城濮。楚师背酅而舍，晋侯患之。",
              translation: "晋文公、宋成公、齐国大夫归父和崔夭、秦国公子憖率军驻扎在城濮。楚军背靠酅地扎营，晋文公为此忧虑。",
              entities: [
                { text: "晋侯", type: "person", description: "晋文公重耳，春秋五霸之一" },
                { text: "宋公", type: "person", description: "宋成公王臣" },
                { text: "齐国归父", type: "person", description: "齐国大夫国归父" },
                { text: "城濮", type: "place", ancientName: "城濮", modernName: "今山东鄄城西南", lat: 35.56, lng: 115.47, poi: "battle", description: "晋楚争霸决战之地" },
                { text: "楚师", type: "person", description: "楚军，主帅子玉" },
                { text: "酅", type: "place", ancientName: "酅", modernName: "今山东东阿", lat: 36.34, lng: 116.25, poi: "city", description: "楚军依山扎营之处" },
              ],
              routes: [
                { name: "晋军进军路线", faction: "晋", color: "#2B4490",
                  points: [{ lat: 35.47, lng: 112.85, label: "晋国出发" }, { lat: 35.85, lng: 114.35, label: "渡河" }, { lat: 35.56, lng: 115.47, label: "城濮" }] },
                { name: "楚军进军路线", faction: "楚", color: "#C41E24",
                  points: [{ lat: 30.95, lng: 112.20, label: "楚国出发" }, { lat: 33.40, lng: 113.85, label: "申" }, { lat: 35.56, lng: 115.47, label: "城濮" }] },
              ],
              territories: [
                { name: "晋", color: "#2B4490", opacity: 0.18 },
                { name: "楚", color: "#C41E24", opacity: 0.18 },
                { name: "齐", color: "#C8893A", opacity: 0.14 },
                { name: "秦", color: "#6B3F1D", opacity: 0.14 },
              ],
            },
            {
              id: "p2",
              original: "子玉使斗勃请战，曰：「请与君之士戏，君冯轼而观之。」晋侯使栾枝对曰：「寡君闻命矣。楚君之惠，未之敢忘，是以在此。」",
              translation: "楚帅子玉派斗勃前来请战，说：「请允许同您的将士较量，您扶轼观看即可。」晋文公派栾枝回话：「我听到您的话了。当年楚君的恩惠，我们未敢忘怀，所以退避至此。」",
              entities: [
                { text: "子玉", type: "person", description: "楚军主帅，令尹成得臣" },
                { text: "斗勃", type: "person", description: "楚国大夫" },
                { text: "栾枝", type: "person", description: "晋国大夫" },
                { text: "退避三舍", type: "event", description: "晋军后退九十里以履行楚君旧诺" },
              ],
              routes: [
                { name: "晋军退避三舍", faction: "晋", color: "#2B4490", dashed: true,
                  points: [{ lat: 35.95, lng: 115.95, label: "原驻地" }, { lat: 35.56, lng: 115.47, label: "城濮" }] },
              ],
              territories: [
                { name: "晋", color: "#2B4490", opacity: 0.18 },
                { name: "楚", color: "#C41E24", opacity: 0.18 },
              ],
            },
          ],
        },
        {
          id: "yao",
          title: "崤之战",
          subtitle: "僖公三十三年",
          year: -627,
          paragraphs: [
            {
              id: "p1",
              original: "夏四月辛巳，败秦师于殽，获百里孟明视、西乞术、白乙丙以归。",
              translation: "夏季四月辛巳日，晋军在崤山击败秦军，俘获百里孟明视、西乞术、白乙丙三位将领押回晋国。",
              entities: [
                { text: "殽", type: "place", ancientName: "崤山", modernName: "今河南三门峡东南", lat: 34.66, lng: 111.30, poi: "pass", description: "崤山，秦晋之间天险" },
                { text: "百里孟明视", type: "person", description: "秦国主帅，百里奚之子" },
                { text: "秦师", type: "person", description: "秦国军队" },
              ],
              routes: [
                { name: "秦军东征路线", faction: "秦", color: "#6B3F1D",
                  points: [{ lat: 34.27, lng: 108.95, label: "雍" }, { lat: 34.50, lng: 110.10, label: "桃林" }, { lat: 34.66, lng: 111.30, label: "崤山" }, { lat: 34.81, lng: 113.65, label: "滑国" }] },
                { name: "晋军伏击", faction: "晋", color: "#2B4490",
                  points: [{ lat: 35.47, lng: 112.85, label: "晋都" }, { lat: 34.66, lng: 111.30, label: "崤山" }] },
              ],
              territories: [
                { name: "秦", color: "#6B3F1D", opacity: 0.18 },
                { name: "晋", color: "#2B4490", opacity: 0.18 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "shiji",
      title: "史记",
      dynasty: "西汉",
      author: "司马迁",
      chapters: [
        {
          id: "julu",
          title: "巨鹿之战",
          subtitle: "项羽本纪",
          year: -207,
          paragraphs: [
            {
              id: "p1",
              original: "项羽乃悉引兵渡河，皆沉船，破釜甑，烧庐舍，持三日粮，以示士卒必死，无一还心。",
              translation: "项羽于是率全军渡过漳河，凿沉所有船只，砸碎炊具，烧毁营房，只携带三天口粮，向士卒表明必死决心，断绝一切退路。",
              entities: [
                { text: "项羽", type: "person", description: "西楚霸王，名籍字羽" },
                { text: "河", type: "place", ancientName: "漳河", modernName: "今河北、河南交界", lat: 36.32, lng: 114.65, poi: "pass", description: "项羽破釜沉舟渡河之处" },
                { text: "破釜沉舟", type: "event", description: "决死一战，背水作战" },
              ],
              routes: [
                { name: "项羽渡河路线", faction: "楚", color: "#C41E24",
                  points: [{ lat: 35.55, lng: 116.55, label: "彭城出发" }, { lat: 36.05, lng: 115.20, label: "安阳" }, { lat: 36.32, lng: 114.65, label: "渡漳河" }, { lat: 37.07, lng: 115.05, label: "巨鹿" }] },
              ],
              territories: [
                { name: "秦", color: "#6B3F1D", opacity: 0.20 },
                { name: "楚", color: "#C41E24", opacity: 0.16 },
              ],
            },
            {
              id: "p2",
              original: "至则围王离，与秦军遇，九战，绝其甬道，大破之，杀苏角，虏王离。",
              translation: "到达后包围秦将王离，与秦军交战，九次激战，切断秦军粮道，大破之，斩杀苏角，俘获王离。",
              entities: [
                { text: "王离", type: "person", description: "秦军主将，王翦之孙" },
                { text: "巨鹿", type: "place", ancientName: "巨鹿", modernName: "今河北平乡西南", lat: 37.07, lng: 115.05, poi: "battle", description: "项羽破釜沉舟，大破秦军" },
                { text: "苏角", type: "person", description: "秦军副将" },
              ],
              routes: [
                { name: "楚军围攻", faction: "楚", color: "#C41E24",
                  points: [{ lat: 36.32, lng: 114.65, label: "漳河" }, { lat: 37.07, lng: 115.05, label: "巨鹿" }] },
                { name: "秦军甬道", faction: "秦", color: "#6B3F1D", dashed: true,
                  points: [{ lat: 38.04, lng: 114.50, label: "章邯驻地" }, { lat: 37.07, lng: 115.05, label: "巨鹿" }] },
              ],
              territories: [
                { name: "秦", color: "#6B3F1D", opacity: 0.20 },
                { name: "楚", color: "#C41E24", opacity: 0.16 },
              ],
            },
          ],
        },
        {
          id: "gaixia",
          title: "垓下之围",
          subtitle: "项羽本纪",
          year: -202,
          paragraphs: [
            {
              id: "p1",
              original: "项王军壁垓下，兵少食尽，汉军及诸侯兵围之数重。夜闻汉军四面皆楚歌，项王乃大惊。",
              translation: "项王在垓下扎营，兵少粮尽，汉军及各诸侯军重重包围。夜里听到汉军四面唱起楚地歌谣，项王大为震惊。",
              entities: [
                { text: "垓下", type: "place", ancientName: "垓下", modernName: "今安徽灵璧东南", lat: 33.40, lng: 117.55, poi: "battle", description: "项羽末路，四面楚歌" },
                { text: "项王", type: "person", description: "项羽" },
                { text: "四面楚歌", type: "event", description: "汉军以楚歌瓦解楚军军心" },
              ],
              routes: [
                { name: "汉军合围", faction: "晋", color: "#2B4490",
                  points: [{ lat: 34.30, lng: 116.80, label: "汉军主力" }, { lat: 33.40, lng: 117.55, label: "垓下" }] },
              ],
              territories: [
                { name: "汉", color: "#2B4490", opacity: 0.18 },
                { name: "楚", color: "#C41E24", opacity: 0.14 },
              ],
            },
            {
              id: "p2",
              original: "于是项王乃欲东渡乌江。乌江亭长檥船待，谓项王曰：「江东虽小，地方千里，众数十万人，亦足王也。」项王笑曰：「天之亡我，我何渡为！」",
              translation: "于是项王打算向东渡过乌江。乌江亭长撑船等候，对项王说：「江东虽小，方圆千里，民众数十万，也足以称王。」项王笑道：「上天要灭亡我，我还渡江干什么！」",
              entities: [
                { text: "乌江", type: "place", ancientName: "乌江", modernName: "今安徽和县东北", lat: 31.72, lng: 118.42, poi: "pass", description: "项羽自刎之地" },
                { text: "项王", type: "person", description: "项羽" },
                { text: "亭长", type: "person", description: "乌江亭长" },
              ],
              routes: [
                { name: "项羽南奔", faction: "楚", color: "#C41E24",
                  points: [{ lat: 33.40, lng: 117.55, label: "垓下" }, { lat: 32.30, lng: 118.10, label: "阴陵" }, { lat: 31.72, lng: 118.42, label: "乌江" }] },
              ],
              territories: [
                { name: "汉", color: "#2B4490", opacity: 0.20 },
              ],
            },
          ],
        },
        {
          id: "qinunify",
          title: "秦统一六国",
          subtitle: "秦始皇本纪",
          year: -221,
          paragraphs: [
            {
              id: "p1",
              original: "秦初并天下，令丞相、御史曰：「异日韩王纳地效玺，请为藩臣，已而倍约，与赵、魏合从畔秦，故兴兵诛之，虏其王。」",
              translation: "秦初统一天下，命丞相、御史说：「往日韩王献地交印，请为藩臣，不久背约，与赵、魏合纵反秦，故出兵讨伐，俘其王。」",
              entities: [
                { text: "秦", type: "person", description: "秦始皇嬴政" },
                { text: "韩", type: "place", ancientName: "韩国都新郑", modernName: "今河南新郑", lat: 34.40, lng: 113.74, poi: "capital", description: "战国韩国都城" },
                { text: "赵", type: "place", ancientName: "赵国都邯郸", modernName: "今河北邯郸", lat: 36.62, lng: 114.54, poi: "capital", description: "战国赵国都城" },
                { text: "魏", type: "place", ancientName: "魏国都大梁", modernName: "今河南开封", lat: 34.80, lng: 114.31, poi: "capital", description: "战国魏国都城" },
              ],
              routes: [
                { name: "秦灭韩", faction: "秦", color: "#6B3F1D",
                  points: [{ lat: 34.27, lng: 108.95, label: "咸阳" }, { lat: 34.40, lng: 113.74, label: "新郑" }] },
                { name: "秦灭赵", faction: "秦", color: "#6B3F1D",
                  points: [{ lat: 34.27, lng: 108.95, label: "咸阳" }, { lat: 36.62, lng: 114.54, label: "邯郸" }] },
                { name: "秦灭魏", faction: "秦", color: "#6B3F1D",
                  points: [{ lat: 34.27, lng: 108.95, label: "咸阳" }, { lat: 34.80, lng: 114.31, label: "大梁" }] },
              ],
              territories: [
                { name: "秦", color: "#6B3F1D", opacity: 0.30 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "shuijing",
      title: "水经注",
      dynasty: "北魏",
      author: "郦道元",
      chapters: [
        {
          id: "sanxia",
          title: "江水·三峡",
          subtitle: "卷三十四",
          year: 520,
          paragraphs: [
            {
              id: "p1",
              original: "自三峡七百里中，两岸连山，略无阙处。重岩叠嶂，隐天蔽日，自非亭午夜分，不见曦月。",
              translation: "从三峡七百里之间，两岸群山相连，几乎没有缺口。重岩叠嶂，遮天蔽日，若非正午或半夜，看不见太阳和月亮。",
              entities: [
                { text: "三峡", type: "place", ancientName: "三峡", modernName: "今长江瞿塘、巫峡、西陵峡", lat: 30.83, lng: 110.50, poi: "pass", description: "长江三峡，瞿塘峡至西陵峡" },
                { text: "两岸连山", type: "event", description: "三峡两岸群山相连" },
              ],
              routes: [],
              territories: [],
            },
          ],
        },
      ],
    },
  ],
};
