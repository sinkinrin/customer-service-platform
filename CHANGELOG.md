# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-01-13

### 鉁?鏂板

#### 瀹炴椂宸ュ崟鏇存柊绯荤粺
- **鎻愪氦**: `aa739b5`, `872e5cc`, `2ba3f29`, `ce774e9`, `513ef73`, `49e0587`
- **鍙樻洿**:
  - 娣诲姞 SSE (Server-Sent Events) 鎺ㄩ€佸眰锛屾敮鎸佸疄鏃跺伐鍗曟洿鏂?
  - 瀹炵幇鏅鸿兘杞鏈哄埗锛堥粯璁?0绉掞紝蹇€熸ā寮?绉掞級
  - 鏂板 `TicketUpdate` 鏁版嵁妯″瀷锛屽瓨鍌ㄥ伐鍗曞彉鏇翠簨浠?
  - 澧炲己 Zammad Webhook锛岃В鏋愬苟瀛樺偍宸ュ崟鍒涘缓/鏇存柊浜嬩欢
  - 闆嗘垚鏈鏍囪鍔熻兘鍒扮鐞嗗憳/鍛樺伐/瀹㈡埛宸ュ崟璇︽儏椤?
  - 鍦ㄥ竷灞€涓坊鍔犳湭璇诲窘绔犳寚绀哄櫒鍜岄珮浜樉绀?
- **褰卞搷**: 鐢ㄦ埛鍙疄鏃舵帴鏀跺伐鍗曠姸鎬佸彉鏇淬€佹柊鍥炲銆佸垎閰嶅彉鏇寸瓑閫氱煡锛屾棤闇€鎵嬪姩鍒锋柊椤甸潰

#### 閭欢閫氱煡绯荤粺锛圸ammad Trigger API锛?
- **鎻愪氦**: `cc2267e`, `a8ef3c1`, `d5194f5`, `219bd76`
- **鍙樻洿**:
  - 闆嗘垚 Zammad Trigger API锛屾敮鎸佽嚜鍔ㄩ偖浠堕€氱煡閰嶇疆
  - 娣诲姞 `/api/admin/triggers` 绠＄悊绔偣鍜屼竴閿垵濮嬪寲鍔熻兘
  - 鍛樺伐/绠＄悊鍛樺洖澶嶆敮鎸佺洿鎺ュ彂閫侀偖浠讹紙Note vs Email 閫夋嫨鍣級
  - 宸ュ崟閲嶆柊鍒嗛厤鏃惰嚜鍔ㄩ€氱煡鍓嶄换璐熻矗浜?
  - 楂樹紭鍏堢骇宸ュ崟鎺掗櫎鑷姩閫氱煡
- **褰卞搷**: 瀹㈡埛鍜屽憳宸ュ彲閫氳繃閭欢鍙婃椂鑾风煡宸ュ崟杩涘睍锛屾彁鍗囧搷搴旀晥鐜?

#### 缁熶竴宸ュ崟鏉冮檺绯荤粺
- **鎻愪氦**: `53b2b86`, `17acce2`
- **鍙樻洿**:
  - 瀹炵幇鍩轰簬瑙掕壊鐨勫伐鍗曡闂帶鍒讹紙Customer/Staff/Admin锛?
  - 鏀剁揣鏉冮檺瑙勫垯锛岄槻姝㈣秺鏉冭闂?
  - 鏇存柊鐩稿叧鏂囨。鍜屾祴璇曠敤渚?
- **褰卞搷**: 澧炲己绯荤粺瀹夊叏鎬э紝纭繚鐢ㄦ埛鍙兘璁块棶鎺堟潈鐨勫伐鍗?

#### 瀹㈡埛鍏抽棴宸ュ崟鍔熻兘
- **鎻愪氦**: `127aa1f`
- **鍙樻洿**:
  - 瀹㈡埛鍙嚜琛屽叧闂凡瑙ｅ喅鐨勫伐鍗?
  - 鏀寔澶氳瑷€鐣岄潰锛坕18n锛?
- **褰卞搷**: 鎻愬崌瀹㈡埛鑷姪鏈嶅姟鑳藉姏锛屽噺灏戝憳宸ュ伐浣滈噺

#### Dashboard 鏁版嵁澧炲己
- **鎻愪氦**: `a5dca0f`, `da482c3`, `ea2512c`
- **鍙樻洿**:
  - 娣诲姞"浠婃棩/鍏ㄩ儴鏃堕棿"鍒囨崲寮€鍏筹紝鏌ョ湅涓嶅悓鏃堕棿鑼冨洿鐨勭粺璁℃暟鎹?
  - 浣跨敤鐪熷疄 Zammad 鏁版嵁灞曠ず姣忔棩宸ュ崟瓒嬪娍鍥?
  - 鍒涘缓缁熶竴 API 鍑忓皯鍐椾綑 Zammad 璋冪敤锛屾彁鍗囨€ц兘
- **褰卞搷**: 绠＄悊鍛樺彲鏇寸伒娲诲湴鏌ョ湅宸ュ崟缁熻锛岄〉闈㈠姞杞介€熷害鎻愬崌

#### UI 缁勪欢浼樺寲
- **鎻愪氦**: `33d9c56`, `7e9ac52`
- **鍙樻洿**:
  - 娣诲姞 Tooltip 缁勪欢锛屾敮鎸佸伐鍗曟爣棰樻偓鍋滄彁绀?
  - 鏀硅繘 NEW 鐘舵€佸窘绔狅紝浣跨敤浜豢鑹叉彁鍗囪瑙夋晥鏋?
- **褰卞搷**: 鐣岄潰鏇村弸濂斤紝淇℃伅灞曠ず鏇存竻鏅?

### 馃悰 淇

#### 鏃堕棿鏍煎紡鍜岃嚜鍔ㄥ垎閰嶉棶棰?
- **鎻愪氦**: `24db302`
- **闂**: 鏃堕棿鏄剧ず鏍煎紡涓嶇粺涓€锛岃嚜鍔ㄥ垎閰嶉€昏緫瀛樺湪闂
- **淇**: 缁熶竴鏃堕棿鏍煎紡涓?`YYYY-MM-DD HH:mm`锛岀Щ闄ゆ湁闂鐨勮嚜鍔ㄥ垎閰嶉€昏緫
- **褰卞搷**: 鏃堕棿鏄剧ず涓€鑷达紝閬垮厤鑷姩鍒嗛厤閿欒

#### Dashboard 鏁版嵁鍑嗙‘鎬ч棶棰?
- **鎻愪氦**: `9b22c54`, `6ee5e23`
- **闂**: 浣跨敤 `searchTickets` 瀵艰嚧鏁版嵁涓嶅噯纭紝鍖哄煙鍥捐〃鏍囩鏄剧ず娣蜂贡
- **淇**: 鏀圭敤 `getAllTickets` 鑾峰彇瀹屾暣鏁版嵁锛屽尯鍩熷浘琛ㄤ粎鏄剧ず鑻辨枃鏍囩
- **褰卞搷**: Dashboard 缁熻鏁版嵁鏇村噯纭彲闈?

#### 鐢ㄦ埛濮撳悕閲嶅闂
- **鎻愪氦**: `2c6a495`
- **闂**: 濮撳悕瀛楁鏈垎绂伙紝瀵艰嚧鏄剧ず閲嶅
- **淇**: 鍒嗙 `firstname` 鍜?`lastname` 瀛楁
- **褰卞搷**: 鐢ㄦ埛濮撳悕鏄剧ず姝ｇ‘

#### 瀹夊叏婕忔礊淇
- **鎻愪氦**: `7520298`
- **闂**: 瀹㈡埛閭鍙浼€狅紝`state_id` 閫昏緫閿欒锛屼緷璧?mockUsers
- **淇**: 闃叉瀹㈡埛閭娆洪獥锛屼慨姝ｇ姸鎬?ID 閫昏緫锛岀Щ闄?mockUsers 渚濊禆
- **褰卞搷**: 绯荤粺瀹夊叏鎬ф樉钁楁彁鍗?

#### 鍥介檯鍖栭噸澶嶉敭闂
- **鎻愪氦**: `759aebc`
- **闂**: 缈昏瘧鏂囦欢涓瓨鍦ㄩ噸澶嶇殑 status/priority 閿?
- **淇**: 绉婚櫎閲嶅閿紝纭繚缈昏瘧涓€鑷存€?
- **褰卞搷**: 澶氳瑷€鐣岄潰鏄剧ず姝ｇ‘

### 馃實 鍥介檯鍖?

#### 缈昏瘧鎭㈠鍜屾湰鍦板寲
- **鎻愪氦**: `893db44`
- **鍙樻洿**: 鎭㈠缂哄け鐨勭炕璇戞枃浠讹紝瀹屽杽 UI 鏈湴鍖?
- **褰卞搷**: 澶氳瑷€鏀寔鏇村畬鏁?

### 鈿?鎬ц兘浼樺寲

#### Dashboard API 浼樺寲
- **鎻愪氦**: `ea2512c`
- **鍙樻洿**: 鍒涘缓缁熶竴 API 绔偣锛屽噺灏戝 Zammad 鐨勫啑浣欒皟鐢?
- **褰卞搷**: Dashboard 鍔犺浇閫熷害鎻愬崌锛屽噺杞?Zammad 鏈嶅姟鍣ㄨ礋鎷?

### 馃摑 鏂囨。

#### OpenSpec 闇€姹傝窡韪?
- **鎻愪氦**: `323f158`, `d5efb59`, `3d8d8fb`, `ae25a2e`, `bc61ff1`
- **鍙樻洿**:
  - 娣诲姞鐢ㄦ埛鍙嶉璺熻釜鍣紙57涓棶棰橈紝19涓凡瑙ｅ喅锛?
  - 鏍囪 12/19 鍙嶉鐨?42 涓棶棰樺叏閮ㄥ畬鎴?
  - 鍒涘缓宸ュ崟鏉冮檺鍜?UX 淇鎻愭
  - 娣诲姞瀹炴椂鏇存柊鎻愭
- **褰卞搷**: 闇€姹傜鐞嗘洿娓呮櫚锛屽紑鍙戣繘搴﹀彲杩借釜

#### 浠诲姟娓呭崟鏇存柊
- **鎻愪氦**: `342ed05`, `8d156b7`, `091302a`
- **鍙樻洿**: 鏍囪宸插畬鎴愮殑浠诲姟锛坱ooltip銆佸疄鏃舵洿鏂扮瓑锛?
- **褰卞搷**: 鍥㈤槦鍗忎綔鏇撮珮鏁?

#### 鏂囨。閲嶇粍
- **鎻愪氦**: `a0893cd`
- **鍙樻洿**: 閲嶇粍瀹炴椂鏇存柊瑙勮寖锛岀Щ鍔?TODO 鍒?`docs/feedback`
- **褰卞搷**: 鏂囨。缁撴瀯鏇存竻鏅?

### 馃摝 鏉傚姟

#### 椤圭洰鏂囦欢鏁寸悊
- **鎻愪氦**: `999e11c`, `f33a704`, `07555e9`
- **鍙樻洿**:
  - 鏁寸悊椤圭洰鏂囦欢缁撴瀯
  - 绉婚櫎鏃у綊妗ｆ枃浠跺拰鏍圭洰褰?TODO
  - 鏇存柊璁よ瘉銆佹秷鎭緭鍏ャ€佺幆澧冨彉閲忓拰渚濊禆
- **褰卞搷**: 浠ｇ爜搴撴洿鏁存磥锛岀淮鎶ゆ洿鏂逛究

---

**缁熻**:
- **39 涓彁浜?*
- **17 涓柊鍔熻兘**
- **7 涓棶棰樹慨澶?*
- **10 涓枃妗ｆ洿鏂?*
- **1 涓€ц兘浼樺寲**
- **4 涓浗闄呭寲鏀硅繘**

**鍗囩骇璇存槑**:
- 鏈涓?**MINOR 鐗堟湰**鍗囩骇锛?.3.2 鈫?0.4.0锛?
- 鏂板瀹炴椂鏇存柊鍜岄偖浠堕€氱煡绛夐噸瑕佸姛鑳?
- 寤鸿鏇存柊鏁版嵁搴撴灦鏋勶紙杩愯 `npx prisma migrate deploy`锛?
- 闇€閰嶇疆 Zammad Trigger锛堣闂?`/admin/triggers/setup`锛?

---

## [0.3.2] - 2025-12-27

### 馃悰 Bug淇

#### 淇9椤瑰叧閿伐鍗曠郴缁熼棶棰橈紙鍩轰簬2025-12-26鐢ㄦ埛鍙嶉锛?
- **鎻愪氦**: `2864a39`
- **鍙嶉鏉ユ簮**: AI鏅鸿兘鏈嶅姟鍙嶉鈥擳icket绯荤粺娴嬭瘯-2025骞?2鏈?6鏃?csv
- **鍙樻洿瑙勬ā**: 31涓枃浠讹紝1588琛屾柊澧烇紝288琛屽垹闄?
- **淇鐜?*: 9/14闂宸插畬鍏ㄨВ鍐筹紙64%锛夛紝2/14閮ㄥ垎瑙ｅ喅锛?4%锛?

**宸蹭慨澶嶉棶棰?*:

1. **宸ュ崟鍒楄〃Tab鐘舵€佹寔涔呭寲** (`src/app/admin/tickets/page.tsx`, `src/app/staff/tickets/page.tsx`)
   - 浣跨敤localStorage淇濆瓨tab閫夋嫨鐘舵€?
   - 椤甸潰杩斿洖鏃惰嚜鍔ㄦ仮澶嶄箣鍓嶇殑tab鐘舵€?
   - 浼樺厛绾э細URL鍙傛暟 > localStorage > 榛樿鍊?

2. **瀹㈡埛宸ュ崟鏄剧ず浼樺寲** (`src/components/ticket/ticket-list.tsx`)
   - 鏀硅繘甯冨眬闂磋窛鍜岃瑙夋晥鏋?
   - 浼樺寲楠ㄦ灦灞忓姞杞界姸鎬侊紙3涓墿灞曞埌10涓級
   - 娣诲姞min-height闃叉甯冨眬鎶栧姩

3. **Dashboard鏄剧ず浠婃棩鏂板鏁版嵁** (`src/app/admin/dashboard/page.tsx`)
   - 浠庢樉绀烘€绘暟鏀逛负鏄剧ず浠婃棩鏂板
   - 杩囨护浠婂ぉ鍒涘缓鐨勫伐鍗?
   - 鏇存柊鏍囩锛?Created today"銆?New today"銆?Resolved today"

4. **宸ュ崟鍒嗛厤鐘舵€佹樉绀?* (`src/components/ticket/ticket-list.tsx`)
   - 娣诲姞鍒嗛厤鐘舵€丅adge锛堝凡鍒嗛厤/寰呭垎閰嶏級
   - 鏄剧ず鍒嗛厤鐨剆taff鍚嶇О
   - 缁胯壊鏍囪宸插垎閰嶏紝榛勮壊鏍囪寰呭垎閰?

5. **淇宸ュ崟鍒嗛厤閫昏緫** (`src/app/api/tickets/[id]/assign/route.ts`)
   - 淇璺ㄥ尯鍩熷垎閰嶉棶棰橈紙濡?4032宸ュ崟锛?
   - 澧炲己鏉冮檺楠岃瘉锛氭鏌ョ敤鎴穉ctive鐘舵€併€丄gent瑙掕壊
   - 鏀寔璺ㄥ尯鍩熷垎閰嶏細鑷姩绉诲姩宸ュ崟鍒皊taff鏈夋潈闄愮殑group
   - 鑷姩鐘舵€佹洿鏂帮細鍒嗛厤鏃跺皢'new'鐘舵€佹敼涓?open'
   - 璇︾粏鐨勯敊璇彁绀哄拰鏃ュ織

6. **宸ュ崟璇︽儏椤垫樉绀轰富棰?* (`src/app/staff/tickets/[id]/page.tsx`)
   - 鍦ㄨ鎯呴〉header鏄剧ず宸ュ崟鏍囬
   - 浣跨敤truncate闃叉鏍囬杩囬暱

7. **Admin鍥炲鏀寔闄勪欢** (`src/components/ticket/ticket-actions.tsx`, `src/app/staff/tickets/[id]/page.tsx`)
   - 娣诲姞鏂囦欢涓婁紶鍔熻兘锛堟渶澶?涓枃浠讹紝姣忎釜10MB锛?
   - 鏀寔鍥剧墖銆丳DF銆佹枃妗ｇ瓑鏍煎紡
   - Base64缂栫爜涓婁紶鍒癦ammad
   - 鏂囦欢棰勮鍜屽垹闄ゅ姛鑳?

8. **宸ュ崟鍒涘缓鍜屾洿鏂版椂闂存樉绀?* (`src/components/ticket/ticket-list.tsx`)
   - 鍚屾椂鏄剧ず鍒涘缓鏃堕棿鍜屾洿鏂版椂闂?
   - 浣跨敤鐩稿鏃堕棿鏍煎紡锛?2 hours ago"锛?
   - 鍒嗗埆鏄剧ずCreated鍜孶pdated鏍囩

9. **瀹㈡埛浜屾鍥炲鏀寔闄勪欢** (`src/app/customer/my-tickets/[id]/page.tsx`)
   - 娣诲姞鏂囦欢涓婁紶缁勪欢锛堟渶澶?涓枃浠讹紝姣忎釜10MB锛?
   - 鏀寔澶氱鏂囦欢鏍煎紡
   - Base64缂栫爜涓婁紶

### 鉁?鏂板鍔熻兘

#### Zammad鐪熷疄璁よ瘉闆嗘垚
- **鏂囦欢**: `src/auth.ts`
- **鍔熻兘**:
  - 浠嶮ock璁よ瘉鍗囩骇鍒扮湡瀹瀂ammad API璁よ瘉
  - 鏀寔閫氳繃Zammad楠岃瘉鐢ㄦ埛鍑嵁
  - 鑷姩鏄犲皠Zammad瑙掕壊锛圓dmin/Agent/Customer锛夊埌绯荤粺瑙掕壊
  - 鎻愬彇鐢ㄦ埛鐨剅egion淇℃伅
- **褰卞搷**: 鐢熶骇绾ц璇侊紝鐪熷疄鐢ㄦ埛鐧诲綍

#### 鍒涘缓宸ュ崟琛ㄥ崟閲嶆瀯
- **鏂囦欢**: `src/app/customer/my-tickets/create/page.tsx`, `messages/*.json`
- **鏂板瀛楁**:
  - 鐗堟湰鍙凤紙Version锛?
  - SN/IMEI锛堝彲閫夛級
  - 浣跨敤骞冲彴锛圥latform锛?
  - 闂鎻忚堪涓庣幇璞?
  - 娴嬭瘯鐜
  - 鍑虹幇鏁伴噺涓庢鐜?
  - 澶嶇幇姝ラ
  - 棰勬湡缁撴灉
  - 瀹為檯缁撴灉
- **鍔熻兘**: 鐢熸垚缁撴瀯鍖栫殑宸ュ崟鍐呭妯℃澘
- **褰卞搷**: 鏇磋鑼冪殑闂鍙嶉娴佺▼

### 馃寪 鍥介檯鍖?

- 鏇存柊鎵€鏈?绉嶈瑷€鏂囦欢锛坋n, zh-CN, fr, es, ru, pt锛?
- 娣诲姞宸ュ崟妯℃澘瀛楁缈昏瘧
- 娣诲姞鍒嗛厤銆佸埛鏂扮瓑鏂板姛鑳界殑缈昏瘧

### 鈿狅笍 宸茬煡闂锛堟湭淇锛?

浠ヤ笅3涓棶棰橀渶瑕佸悗缁鐞嗭紙宸插垱寤篛penSpec鎻愭锛夛細

1. **瀹炴椂娑堟伅鎻愰啋鍜屾湭璇婚珮浜?* - 闇€瑕乄ebSocket/SSE瀹炵幇
2. **鐘舵€佸彉鍖栧疄鏃跺悓姝ュ埌鑱婂ぉ椤甸潰** - 闇€瑕佸疄鏃舵洿鏂版満鍒?
3. **瀹㈡埛閭欢閫氱煡** - 闇€瑕乑ammad鍚庣閰嶇疆

### 馃摝 娴嬭瘯

- 鏇存柊鍖哄煙鏉冮檺娴嬭瘯鐢ㄤ緥 (`__tests__/unit/regions.test.ts`)

---

## [0.3.1] - 2025-12-05

### 馃敀 瀹夊叏

#### 鍗囩骇 Next.js 鑷?14.2.25
- **鏂囦欢**: `package.json`, `next.config.js`
- **淇**: CVE-2025-29927 (Middleware 璁よ瘉缁曡繃婕忔礊)
- **鍙樻洿**:
  - `next` 浠?`^14.0.0` 鍗囩骇鑷?`14.2.25`
  - 娣诲姞 `experimental.staleTimes` 閰嶇疆浼樺寲瀹㈡埛绔矾鐢辩紦瀛?
  - 娣诲姞 `dev:turbo` 鑴氭湰鏀寔 Turbopack 寮€鍙戞ā寮?
- **鐩稿叧 OpenSpec**: `upgrade-nextjs-14.2/`

### 鈿?鎬ц兘浼樺寲

#### Customer Dashboard Server Component 閲嶆瀯
- **鏂囦欢**:
  - `src/app/customer/dashboard/page.tsx` (閲嶆瀯涓?Server Component)
  - `src/app/customer/dashboard/dashboard-content.tsx` (鏂板缓 Client Component)
- **鍙樻洿**:
  - 椤甸潰鏀逛负 Server Component锛岀炕璇戝湪鏈嶅姟绔畬鎴?
  - 瀹㈡埛绔粍浠舵帴鏀堕缈昏瘧鐨勫瓧绗︿覆锛屽噺灏戝鎴风 JS 浣撶Н
  - 涓烘湭鏉?PPR (Partial Prerendering) 鍋氬噯澶?
- **娉ㄦ剰**: PPR 闇€瑕?Next.js canary 鐗堟湰锛屾殏鏃舵敞閲?

## [0.3.0] - 2025-12-04

### 鉁?鏂板

#### NextAuth.js v5 璁よ瘉绯荤粺闆嗘垚
- **鏂囦欢**:
  - `src/auth.ts` (鏂板缓)
  - `src/app/api/auth/[...nextauth]/route.ts` (鏂板缓)
  - `src/lib/hooks/use-auth.ts` (閲嶅啓)
  - `src/middleware.ts` (鏇存柊)
  - `src/lib/utils/auth.ts` (鏇存柊)
  - `src/components/providers/session-provider.tsx` (鏇存柊)
- **鍙樻洿**:
  - 浠?mock auth 杩佺Щ鍒?NextAuth.js v5
  - 浣跨敤 `useSession` 鏇夸唬鑷畾涔?Zustand store 杩涜浼氳瘽绠＄悊
  - 涓棿浠堕泦鎴?NextAuth 杩涜璺敱淇濇姢
  - 鏀寔 Credentials Provider 璁よ瘉
- **褰卞搷**: 鐢熶骇绾ц璇佺郴缁燂紝鏀寔鐪熷疄鐢ㄦ埛鐧诲綍鍜屼細璇濈鐞?

#### 鏃犳潈闄愯闂〉闈?
- **鏂囦欢**: `src/app/unauthorized/page.tsx`, `src/app/unauthorized/unauthorized-content.tsx` (鏂板缓)
- **鍔熻兘**: 褰撶敤鎴峰皾璇曡闂棤鏉冮檺璺敱鏃舵樉绀哄弸濂芥彁绀?
- **鏀寔**: 澶氳瑷€銆佽繑鍥炴寜閽?

#### 璁よ瘉閿欒椤甸潰
- **鏂囦欢**: `src/app/auth/error/page.tsx` (鏂板缓)
- **鍔熻兘**: 缁熶竴澶勭悊璁よ瘉閿欒锛屾樉绀虹敤鎴峰弸濂界殑閿欒淇℃伅

#### 璺敱甯搁噺妯″潡
- **鏂囦欢**: `src/lib/constants/routes.ts` (鏂板缓)
- **鍔熻兘**: 缁熶竴绠＄悊鍏叡璺敱鍒楄〃锛屽噺灏戦噸澶嶅畾涔?

#### AI 瀵硅瘽 UX 澧炲己缁勪欢
- **鏂囦欢**:
  - `src/components/conversation/ai-thinking-indicator.tsx` (鏂板缓)
  - `src/components/conversation/markdown-message.tsx` (鏂板缓)
- **鍔熻兘**: AI 鎬濊€冪姸鎬佸姩鐢汇€丮arkdown 娑堟伅娓叉煋锛堜唬鐮侀珮浜級
- **鐩稿叧 OpenSpec**: `enhance-ai-conversation-ux/`

### 馃悰 淇

#### 淇宸ュ崟鍒嗙粍閫昏緫涓嶄竴鑷?
- **鏂囦欢**: `src/app/api/tickets/route.ts`
- **闂**: Customer 鍒涘缓鐨勫伐鍗曚娇鐢ㄩ粯璁?"Users" 缁勶紝瀵艰嚧 Staff 鎸夊尯鍩熸棤娉曠湅鍒板鎴峰伐鍗?
- **淇**: 鎵€鏈夌敤鎴凤紙customer/staff/admin锛夊垱寤哄伐鍗曟椂缁熶竴浣跨敤 region 瀵瑰簲鐨?group
- **褰卞搷**: Staff 鍙互姝ｇ‘鐪嬪埌鍏跺尯鍩熷唴瀹㈡埛鍒涘缓鐨勫伐鍗?

#### 淇 Staff 宸ュ崟鎼滅储鏉冮檺闂
- **鏂囦欢**: `src/app/api/tickets/route.ts`, `src/app/api/tickets/search/route.ts`
- **闂**: 浣跨敤 X-On-Behalf-Of 瀵艰嚧 Staff 鍙兘鐪嬪埌鑷繁琚垎閰嶇殑宸ュ崟
- **淇**: Staff 鑾峰彇鍏ㄩ儴宸ュ崟鍚庢寜 region 杩囨护锛屼笉鍐嶄娇鐢?X-On-Behalf-Of
- **褰卞搷**: Staff 鍙互鐪嬪埌鍏跺尯鍩熷唴鎵€鏈夊鎴峰垱寤虹殑宸ュ崟

#### 淇 priority_id 楠岃瘉鑼冨洿
- **鏂囦欢**: `src/app/api/tickets/route.ts`
- **淇**: `priority_id` 涓婇檺浠?4 鏀逛负 3锛岀鍚?Zammad 瀹為檯浼樺厛绾ц寖鍥?

### 馃摝 渚濊禆鏇存柊

- 鏂板: `next-auth@^5.0.0-beta.30` - NextAuth.js v5 璁よ瘉妗嗘灦
- 鏂板: `@auth/prisma-adapter@^2.11.1` - Prisma 閫傞厤鍣?
- 鏂板: `react-markdown@^10.1.0` - Markdown 娓叉煋
- 鏂板: `react-syntax-highlighter@^16.1.0` - 浠ｇ爜璇硶楂樹寒
- 鏂板: `remark-gfm@^4.0.1` - GitHub Flavored Markdown 鏀寔

### 馃寪 鍥介檯鍖栨洿鏂?

- 鏇存柊鎵€鏈夎瑷€鏂囦欢锛坋n, zh-CN, fr, es, ru, pt锛夋坊鍔犺璇佺浉鍏崇炕璇?

### 馃摑 OpenSpec 鍙樻洿

- 鏂板: `fix-nextauth-integration-gaps/` - NextAuth 闆嗘垚闂淇
- 鏂板: `enhance-ai-conversation-ux/` - AI 瀵硅瘽浣撻獙澧炲己

### 鍙傝€?

- 浠ｇ爜瀹℃煡: review.md

---

## [0.2.3] - 2025-11-28

### 馃悰 淇

#### 淇鐜鍙橀噺楠岃瘉涓嶆帴鍙?NEXTAUTH_SECRET
- **鏂囦欢**: `src/lib/env.ts`
- **闂**: 鐢熶骇鐜楠岃瘉浠呮鏌?`AUTH_SECRET`锛屼娇鐢ㄦ爣鍑?`NEXTAUTH_SECRET` 鐨勯儴缃蹭細澶辫触
- **淇**:
  - 娣诲姞 `hasAuthSecret()` 杈呭姪鍑芥暟锛屽悓鏃舵鏌?`AUTH_SECRET` 鍜?`NEXTAUTH_SECRET`
  - 娣诲姞 `getAuthSecret()` 杈呭姪鍑芥暟锛屼紭鍏堜娇鐢?`AUTH_SECRET`锛屽洖閫€鍒?`NEXTAUTH_SECRET`
  - 鏇存柊 `validateEnv()` 浣跨敤鏂扮殑杈呭姪鍑芥暟
- **褰卞搷**: 鏀寔涓ょ鐜鍙橀噺鍛藉悕锛屾彁楂樺吋瀹规€?

#### 淇 /api/health 绔偣璁よ瘉瀵嗛挜妫€娴?
- **鏂囦欢**: `src/app/api/health/route.ts`
- **闂**: `hasAuthSecret` 閰嶇疆椤逛粎妫€鏌?`AUTH_SECRET`锛屽拷鐣?`NEXTAUTH_SECRET`
- **淇**: 浣跨敤 `hasAuthSecret()` 鍑芥暟鏇夸唬鐩存帴妫€鏌?`process.env.AUTH_SECRET`
- **褰卞搷**: 鍋ュ悍妫€鏌ユ纭姤鍛婅璇侀厤缃姸鎬?

#### 淇鐧诲綍鍚庨噸瀹氬悜浣跨敤杩囨湡瑙掕壊
- **鏂囦欢**: `src/app/auth/login/page.tsx`
- **闂**: 鐧诲綍鎴愬姛鍚庤皟鐢?`getUserRole()` 鑾峰彇缂撳瓨鐨勮鑹诧紝鍙兘杩斿洖榛樿鐨?"customer" 鑰岄潪瀹為檯瑙掕壊
- **淇**: 鐩存帴浣跨敤 `signIn` 鍝嶅簲涓殑鏈€鏂?`authData.user.role` 杩涜閲嶅畾鍚?
- **褰卞搷**: 绠＄悊鍛樺拰鍛樺伐鐧诲綍鍚庢纭烦杞埌瀵瑰簲浠〃鏉匡紝鏃犻渶绛夊緟浼氳瘽鏇存柊

### 鍙傝€?

- 浠ｇ爜瀹℃煡: review.md

---

## [0.2.2] - 2025-11-26

### 馃悰 淇

#### 淇 staff/loading.tsx 纭紪鐮佸瓧绗︿覆
- **鏂囦欢**: `src/app/staff/loading.tsx`
- **闂**: 椤甸潰鍔犺浇缁勪欢浣跨敤纭紪鐮佽嫳鏂囧瓧绗︿覆 "Loading staff tools..." 鍜?"Syncing conversations and tickets"
- **淇**:
  - 杞崲涓哄紓姝ユ湇鍔″櫒缁勪欢锛屼娇鐢?`getTranslations` from `next-intl/server`
  - 娣诲姞 `staff.loading.message` 鍜?`staff.loading.hint` 缈昏瘧閿?
- **褰卞搷**: 鍛樺伐闂ㄦ埛鍔犺浇椤甸潰鐜板湪鏀寔澶氳瑷€鏄剧ず

#### 淇 complaints/page.tsx 閿欒娑堟伅纭紪鐮?
- **鏂囦欢**: `src/app/customer/complaints/page.tsx`
- **闂**: 閿欒澶勭悊浠ｇ爜浣跨敤纭紪鐮佽嫳鏂囧瓧绗︿覆 'Failed to submit complaint' 浣滀负 fallback
- **淇**:
  - 娣诲姞 `tToast` 缈昏瘧 hook 鐢ㄤ簬 toast 娑堟伅
  - 浣跨敤 `tToast('submitError')` 鏇夸唬纭紪鐮佸瓧绗︿覆
- **褰卞搷**: 瀹㈡埛鎶曡瘔鎻愪氦閿欒娑堟伅鐜板湪鏀寔澶氳瑷€鏄剧ず

### 鉁?鏂板

#### 娣诲姞 staff.loading 缈昏瘧閿埌鎵€鏈夎瑷€鏂囦欢
- **鏂囦欢**: `messages/en.json`, `messages/zh-CN.json`, `messages/fr.json`, `messages/es.json`, `messages/ru.json`, `messages/pt.json`
- **鍐呭**:
  - `staff.loading.message`: 鍛樺伐宸ュ叿鍔犺浇娑堟伅
  - `staff.loading.hint`: 鍚屾鎻愮ず淇℃伅
- **缈昏瘧**:
  - 鑻辫: "Loading staff tools..." / "Syncing conversations and tickets"
  - 绠€浣撲腑鏂? "鍔犺浇鍛樺伐宸ュ叿涓?.." / "姝ｅ湪鍚屾瀵硅瘽鍜屽伐鍗?
  - 娉曡: "Chargement des outils du personnel..." / "Synchronisation des conversations et tickets"
  - 瑗跨彮鐗欒: "Cargando herramientas del personal..." / "Sincronizando conversaciones y tickets"
  - 淇勮: "袟邪谐褉褍蟹泻邪 懈薪褋褌褉褍屑械薪褌芯胁 锌械褉褋芯薪邪谢邪..." / "小懈薪褏褉芯薪懈蟹邪褑懈褟 褉邪蟹谐芯胁芯褉芯胁 懈 蟹邪褟胁芯泻"
  - 钁¤悇鐗欒: "Carregando ferramentas da equipe..." / "Sincronizando conversas e tickets"

### 馃搳 i18n 瑕嗙洊鐜?

| 鎸囨爣 | 淇鍓?| 淇鍚?|
|------|--------|--------|
| 纭紪鐮佸瓧绗︿覆 | 2澶?| 0澶?|
| 缈昏瘧瀹屾暣鎬?| 99.7% | 100% |

### 鎶€鏈粏鑺?

- 鍩轰簬 acemcp 浠ｇ爜妫€绱㈠彂鐜扮殑閬楁紡纭紪鐮?
- 浣跨敤 Playwright 杩涜澶氳瑷€鍒囨崲娴嬭瘯楠岃瘉
- 淇濇寔涓庣幇鏈?i18n 鏋舵瀯涓€鑷?
- 鎵€鏈?绉嶈瑷€锛坋n, zh-CN, fr, es, ru, pt锛夊畬鍏ㄨ鐩?

---

## 馃摎 鍘嗗彶鐗堟湰褰掓。

鏇存棭鐨勭増鏈褰曞凡褰掓。鍒颁互涓嬫枃浠讹細

| 骞翠唤 | 鏂囦欢 | 鐗堟湰鑼冨洿 | 璇存槑 |
|------|------|----------|------|
| 2025 | [changelogs/CHANGELOG-2025-mid.md](changelogs/CHANGELOG-2025-mid.md) | v0.2.0 - v0.2.1 | 涓湡鐗堟湰锛圔ug淇銆侀敊璇鐞嗘敼杩涳級 |
| 2025 | [changelogs/CHANGELOG-2025-early.md](changelogs/CHANGELOG-2025-early.md) | v0.1.0 - v0.1.9 | 鏃╂湡鐗堟湰锛堝熀纭€鍔熻兘瀹炵幇锛?|

**褰掓。璇存槑**:
- 涓?CHANGELOG.md 淇濈暀鏈€杩?5 涓増鏈殑璇︾粏璁板綍
- 鏃х増鏈Щ鑷冲綊妗ｆ枃浠朵互淇濇寔涓绘枃浠剁畝娲?
- 褰掓。鏂囦欢鎸夊勾浠藉拰鏃堕棿娈电粍缁囷紝渚夸簬鏌ユ壘鍘嗗彶鍙樻洿
