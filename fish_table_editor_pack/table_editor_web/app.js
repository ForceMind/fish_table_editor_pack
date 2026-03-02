"use strict";

const state={
  tableDir:"",logicHint:{},arenas:[],fish:[],groups:[],routes:[],scripts:[],
  groupMap:new Map(),fishMap:new Map(),selectedArenaId:null,
  viewMode:"cut",leftBossFilter:"all",pickerBossFilter:"all",
  pickerRowIndex:-1,pickerSelected:new Set(),dragFromIndex:-1,dragOverIndex:-1,
  presets:[],selectedPresetName:"",
  llmConfig:{mode:"auto",minPerArena:6,baseUrl:"https://api.openai.com/v1",model:"gpt-4.1-mini",apiKey:"",temperature:0.2,maxTokens:2048},
  timelineScale:{pxPerMs:0.005,baseX:70},
  gapDrag:{active:false,scriptIndex:-1,startX:0,startGapMs:0,pxPerMs:0.005}
};

const els={
  tableDir:document.getElementById("table-dir"),logicList:document.getElementById("logic-list"),
  arenaTags:document.getElementById("arena-tags"),groupSearch:document.getElementById("group-search"),
  groupBossFilter:document.getElementById("group-boss-filter"),groupList:document.getElementById("group-list"),
  scriptTbody:document.getElementById("script-tbody"),timelineArenaSelect:document.getElementById("timeline-arena-select"),
  timelineViewMode:document.getElementById("timeline-view-mode"),timelineSummary:document.getElementById("timeline-summary"),
  timelineTrack:document.getElementById("timeline-track"),timelineEvents:document.getElementById("timeline-events"),generateReport:document.getElementById("generate-report"),
  presetSelect:document.getElementById("preset-select"),
  genMode:document.getElementById("gen-mode"),genMinPerArena:document.getElementById("gen-min-per-arena"),
  llmBaseUrl:document.getElementById("llm-base-url"),llmModel:document.getElementById("llm-model"),
  llmApiKey:document.getElementById("llm-api-key"),llmTemperature:document.getElementById("llm-temperature"),llmMaxTokens:document.getElementById("llm-max-tokens"),
  groupPicker:document.getElementById("group-picker"),pickerRowInfo:document.getElementById("picker-row-info"),
  pickerSearch:document.getElementById("picker-search"),pickerBossFilter:document.getElementById("picker-boss-filter"),
  pickerList:document.getElementById("picker-list"),toast:document.getElementById("toast")
};

bindEvents();
initLLMConfig();
loadData();

function bindEvents(){
  document.getElementById("reload-btn").addEventListener("click",()=>loadData());
  document.getElementById("add-row-btn").addEventListener("click",addScriptRow);
  document.getElementById("sort-btn").addEventListener("click",sortScriptsById);
  document.getElementById("auto-generate-btn").addEventListener("click",onAutoGenerateScripts);
  document.getElementById("save-btn").addEventListener("click",()=>saveScripts(""));
  document.getElementById("save-as-btn").addEventListener("click",onSaveAs);
  document.getElementById("llm-save-btn").addEventListener("click",()=>saveLLMConfig(true));
  document.getElementById("preset-load-btn").addEventListener("click",onPresetLoad);
  document.getElementById("preset-save-btn").addEventListener("click",onPresetSaveCurrent);
  document.getElementById("preset-delete-btn").addEventListener("click",onPresetDelete);
  els.presetSelect.addEventListener("change",()=>{state.selectedPresetName=els.presetSelect.value||"";});
  for(const node of [els.genMode,els.genMinPerArena,els.llmBaseUrl,els.llmModel,els.llmApiKey,els.llmTemperature,els.llmMaxTokens]){
    if(!node) continue;
    node.addEventListener("change",()=>saveLLMConfig(false));
    node.addEventListener("blur",()=>saveLLMConfig(false));
  }

  els.groupSearch.addEventListener("input",renderGroupList);
  els.groupBossFilter.addEventListener("change",()=>{state.leftBossFilter=els.groupBossFilter.value;renderGroupList();});

  els.timelineArenaSelect.addEventListener("change",()=>{
    state.selectedArenaId=Number(els.timelineArenaSelect.value)||null;
    renderScriptTable();
    renderTimeline();
  });
  els.timelineViewMode.addEventListener("change",()=>{state.viewMode=els.timelineViewMode.value||"cut";renderTimeline();});

  els.scriptTbody.addEventListener("input",onScriptInput);
  els.scriptTbody.addEventListener("click",onScriptActions);
  els.scriptTbody.addEventListener("dragstart",onRowDragStart);
  els.scriptTbody.addEventListener("dragover",onRowDragOver);
  els.scriptTbody.addEventListener("drop",onRowDrop);
  els.scriptTbody.addEventListener("dragend",clearDragState);

  els.timelineTrack.addEventListener("mousedown",onTimelineMouseDown);
  document.addEventListener("mousemove",onTimelineMouseMove);
  document.addEventListener("mouseup",onTimelineMouseUp);

  document.getElementById("picker-close").addEventListener("click",()=>els.groupPicker.close());
  document.getElementById("picker-clear").addEventListener("click",()=>{state.pickerSelected.clear();renderPickerList();});
  document.getElementById("picker-apply").addEventListener("click",applyPicker);
  els.pickerSearch.addEventListener("input",renderPickerList);
  els.pickerBossFilter.addEventListener("change",()=>{state.pickerBossFilter=els.pickerBossFilter.value;renderPickerList();});
  els.pickerList.addEventListener("change",onPickerChange);
}

async function loadData(){
  try{
    const res=await fetch("/api/data");
    const data=await res.json();
    if(!data.ok) throw new Error(data.error||"读取失败");
    state.tableDir=data.tableDir||"";
    state.logicHint=data.logicHint||{};
    state.arenas=data.arenas||[];
    state.fish=data.fish||[];
    state.groups=data.groups||[];
    state.routes=data.routes||[];
    state.scripts=(data.scripts||[]).map(normalizeScriptRow);
    state.groupMap=new Map(state.groups.map(g=>[g.id,g]));
    state.fishMap=new Map(state.fish.map(f=>[f.id,f]));
    if(!state.selectedArenaId&&state.arenas.length) state.selectedArenaId=state.arenas[0].id;
    renderAll();
    await loadPresetList(state.selectedPresetName);
    toast("已读取配置表");
  }catch(err){toast(`读取失败: ${err.message}`,true);}
}

function initLLMConfig(){
  const key="fish_table_editor.llm_config.v1";
  try{
    const raw=localStorage.getItem(key);
    if(raw){
      const parsed=JSON.parse(raw);
      state.llmConfig={...state.llmConfig,...parsed};
    }
  }catch(_err){}
  applyLLMConfigToInputs();
}

function clampNum(v,min,max,def){
  const n=Number(v);
  if(!Number.isFinite(n)) return def;
  return Math.max(min,Math.min(max,n));
}

function readLLMConfigFromInputs(){
  return {
    mode:(els.genMode?.value||"auto"),
    minPerArena:Math.round(clampNum(els.genMinPerArena?.value,3,20,6)),
    baseUrl:(els.llmBaseUrl?.value||"https://api.openai.com/v1").trim(),
    model:(els.llmModel?.value||"gpt-4.1-mini").trim(),
    apiKey:(els.llmApiKey?.value||"").trim(),
    temperature:clampNum(els.llmTemperature?.value,0,1,0.2),
    maxTokens:Math.round(clampNum(els.llmMaxTokens?.value,512,8192,2048))
  };
}

function applyLLMConfigToInputs(){
  if(els.genMode) els.genMode.value=state.llmConfig.mode||"auto";
  if(els.genMinPerArena) els.genMinPerArena.value=String(state.llmConfig.minPerArena||6);
  if(els.llmBaseUrl) els.llmBaseUrl.value=state.llmConfig.baseUrl||"https://api.openai.com/v1";
  if(els.llmModel) els.llmModel.value=state.llmConfig.model||"gpt-4.1-mini";
  if(els.llmApiKey) els.llmApiKey.value=state.llmConfig.apiKey||"";
  if(els.llmTemperature) els.llmTemperature.value=String(state.llmConfig.temperature??0.2);
  if(els.llmMaxTokens) els.llmMaxTokens.value=String(Math.round(clampNum(state.llmConfig.maxTokens,512,8192,2048)));
}

function saveLLMConfig(showToast){
  state.llmConfig=readLLMConfigFromInputs();
  const key="fish_table_editor.llm_config.v1";
  try{
    localStorage.setItem(key,JSON.stringify(state.llmConfig));
    if(showToast) toast("LLM配置已保存（本浏览器本地）");
  }catch(err){
    if(showToast) toast(`保存LLM配置失败: ${err.message}`,true);
  }
}

function getLLMRequestConfig(){
  state.llmConfig=readLLMConfigFromInputs();
  return {
    mode:state.llmConfig.mode||"auto",
    minPerArena:Math.round(clampNum(state.llmConfig.minPerArena,3,20,6)),
    baseUrl:(state.llmConfig.baseUrl||"https://api.openai.com/v1").trim(),
    model:(state.llmConfig.model||"gpt-4.1-mini").trim(),
    apiKey:(state.llmConfig.apiKey||"").trim(),
    temperature:clampNum(state.llmConfig.temperature,0,1,0.2),
    maxTokens:Math.round(clampNum(state.llmConfig.maxTokens,512,8192,2048))
  };
}

function payoutThresholds(){
  const vals=state.groups.filter(g=>!groupHasBoss(g)).map(g=>Number(g.avgPayout)||0).filter(x=>x>0).sort((a,b)=>a-b);
  if(!vals.length) return {low:0,high:0};
  const low=vals[Math.floor(vals.length*0.33)]||vals[0];
  const high=vals[Math.floor(vals.length*0.72)]||vals[vals.length-1];
  return {low,high};
}

function payoutTier(payout,th){
  const p=Number(payout)||0;
  if(p<=th.low) return "low";
  if(p<=th.high) return "mid";
  return "high";
}

function renderGenerateReport(scripts){
  if(!els.generateReport) return;
  const rows=Array.isArray(scripts)?scripts:[];
  if(!rows.length){
    els.generateReport.textContent="生成报告：暂无脚本。";
    return;
  }
  const th=payoutThresholds();
  const arenaStat=new Map();
  const bump=(arenaId)=>{
    if(!arenaStat.has(arenaId)) arenaStat.set(arenaId,{scripts:0,boss:0,low:0,mid:0,high:0});
    return arenaStat.get(arenaId);
  };
  for(const row of rows){
    const arenaIds=parseIds(row.arenaIds);
    const gids=parseIds(row.groupIds);
    for(const arenaId of arenaIds){
      const st=bump(arenaId);
      st.scripts+=1;
      for(const gid of gids){
        const g=state.groupMap.get(gid);
        if(!g) continue;
        if(groupHasBoss(g)){st.boss+=1;continue;}
        const tier=payoutTier(g.avgPayout,th);
        st[tier]+=1;
      }
    }
  }
  const lines=[];
  for(const [arenaId,st] of Array.from(arenaStat.entries()).sort((a,b)=>a[0]-b[0])){
    const bossTag=st.boss===1?"Boss=1":"Boss="+st.boss;
    lines.push(`Arena ${arenaId}: 脚本${st.scripts}条 | ${bossTag} | 低/中/高=${st.low}/${st.mid}/${st.high}`);
  }
  els.generateReport.textContent="生成报告： "+lines.join(" ； ");
}

function normalizeScriptRow(row){
  return {scriptId:num(row.scriptId,0),gapTimeMs:Math.max(0,num(row.gapTimeMs,0)),arenaIds:parseIds(row.arenaIds),type:num(row.type,1),groupIds:parseIds(row.groupIds)};
}

function renderAll(){
  els.tableDir.textContent=`配置目录: ${state.tableDir}`;
  renderLogic();
  renderArenaTags();
  renderArenaSelect();
  renderGroupList();
  renderScriptTable();
  renderTimeline();
  renderGenerateReport(state.scripts);
}

function renderLogic(){
  const items=Object.entries(state.logicHint);
  els.logicList.innerHTML=items.map(([k,v])=>`<li><b>${escapeHtml(k)}</b>：${escapeHtml(v)}</li>`).join("");
}

function renderArenaTags(){
  els.arenaTags.innerHTML=state.arenas.map(a=>`<span class="tag">#${a.id} ${escapeHtml(a.name)} (Scene:${a.scene})</span>`).join("");
}

function renderArenaSelect(){
  if(!state.arenas.length){els.timelineArenaSelect.innerHTML=`<option value="">无场次</option>`;return;}
  els.timelineArenaSelect.innerHTML=state.arenas.map(a=>`<option value="${a.id}" ${a.id===state.selectedArenaId?"selected":""}>Arena ${a.id} - ${escapeHtml(a.name)}</option>`).join("");
}

function filterGroups(keyword,bossFilter){
  const text=(keyword||"").trim().toLowerCase();
  return state.groups.filter(g=>{
    const hasBoss=groupHasBoss(g);
    if(bossFilter==="boss"&&!hasBoss) return false;
    if(bossFilter==="normal"&&hasBoss) return false;
    if(!text) return true;
    const source=[String(g.id),joinIds(g.routeIds||[]),joinIds(g.fishIds||[]),(g.fishCnNames||[]).join(","),(g.fishNames||[]).join(","),(g.fishLabels||[]).join(","),hasBoss?"boss":"normal"].join("|").toLowerCase();
    return source.includes(text);
  });
}

function getGroupFishList(g){
  if(!g) return [];
  if(Array.isArray(g.fishList)&&g.fishList.length) return g.fishList;
  const ids=parseIds(g.fishIds||[]);
  if(!ids.length) return [];
  return ids.map(id=>state.fishMap.get(id)||{
    id,name:`Fish-${id}`,cnName:`Fish-${id}`,cnFullName:`Fish-${id}`,fishType:0,payout:0,payoutText:"0"
  });
}

function groupFishCount(g){
  const fishList=getGroupFishList(g);
  if(fishList.length) return fishList.length;
  if(Array.isArray(g?.composition)&&g.composition.length){
    return g.composition.reduce((sum,item)=>sum+Math.max(0,num(item?.count,0)),0);
  }
  return 0;
}

function renderGroupList(){
  const list=filterGroups(els.groupSearch.value,state.leftBossFilter).slice(0,220);
  if(!list.length){els.groupList.innerHTML=`<p class="muted">无匹配鱼群</p>`;return;}
  els.groupList.innerHTML=list.map(g=>groupCard(g)).join("");
}

function groupCard(g){
  const hasBoss=groupHasBoss(g);
  const headTags=[hasBoss?`<span class="chip warn">Boss</span>`:`<span class="chip">Normal</span>`,g.hasSkill?`<span class="chip">Skill</span>`:"",`<span class="chip">Avg赔率:${g.avgPayout}</span>`,`<span class="chip">Route:${escapeHtml(joinIds(g.routeIds||[]))}</span>`].join("");
  const fishChips=(g.composition||[]).slice(0,6).map(c=>`<span class="chip">${escapeHtml(`${c.cnName} x${c.count} @${c.payoutText}`)}</span>`).join("");
  const fishList=getGroupFishList(g);
  const orderedFish=fishList.slice(0,16).map((f,i)=>`${i+1}.${f.cnFullName}(${f.payoutText}倍)`).join(" -> ");
  const hasMore=fishList.length>16;
  return `<div class="group-item">
    <div class="id">Group ${g.id}</div>
    <div class="chip-row">${headTags}</div>
    <div class="group-meta">Boss:${hasBoss?"是":"否"} | Skill:${g.hasSkill?"是":"否"} | 鱼数量:${fishList.length||groupFishCount(g)}</div>
    <div class="chip-row" style="margin-top:4px">${fishChips}</div>
    <div class="group-order">顺序: ${escapeHtml(orderedFish)}${hasMore?" ...":""}</div>
  </div>`;
}

function findDuplicateScriptIds(){
  const count=new Map();
  for(const row of state.scripts) count.set(row.scriptId,(count.get(row.scriptId)||0)+1);
  const dup=new Set();
  for(const [k,v] of count.entries()) if(k>0&&v>1) dup.add(k);
  return dup;
}

function renderScriptTable(){
  if(!state.scripts.length){els.scriptTbody.innerHTML=`<tr><td colspan="9" class="muted">暂无脚本行，点击“新增脚本行”</td></tr>`;return;}
  const dup=findDuplicateScriptIds();
  const timing=buildSelectedArenaTiming();
  els.scriptTbody.innerHTML=state.scripts.map((row,idx)=>renderScriptRow(row,idx,dup,timing)).join("");
  renderGenerateReport(state.scripts);
}

function renderScriptRow(row,idx,dup,timing){
  const unknownGroups=row.groupIds.filter(id=>!state.groupMap.has(id));
  const unknownArenas=row.arenaIds.filter(id=>!state.arenas.some(a=>a.id===id));
  const minGapMs=getMinAllowedGapByGroupIds(row.groupIds);
  const warn=[];
  if(dup.has(row.scriptId)) warn.push(`<span class="chip warn">ScriptId重复</span>`);
  if(unknownGroups.length) warn.push(`<span class="chip warn">未知Group:${escapeHtml(joinIds(unknownGroups))}</span>`);
  if(unknownArenas.length) warn.push(`<span class="chip warn">未知Arena:${escapeHtml(joinIds(unknownArenas))}</span>`);
  if(row.groupIds.length>1&&row.gapTimeMs<minGapMs) warn.push(`<span class="chip warn">Group间隔过小(最小${minGapMs}ms)</span>`);
  return `<tr data-idx="${idx}">
    <td class="drag-cell w-order"><span class="drag-handle" draggable="true" data-drag-idx="${idx}" title="拖拽排序">↕</span></td>
    <td class="w-index">${idx+1}</td>
    <td class="w-script-id"><input class="cell-input" data-field="scriptId" type="number" value="${row.scriptId}"></td>
    <td class="w-gap"><input class="cell-input" data-field="gapTimeMs" type="number" value="${row.gapTimeMs}" min="${minGapMs}" title="最小 ${minGapMs}ms"></td>
    <td><input class="cell-input" data-field="arenaIds" value="${escapeAttr(joinIds(row.arenaIds))}" placeholder="1,4"></td>
    <td class="w-type"><input class="cell-input" data-field="type" type="number" value="${row.type}"></td>
    <td><input class="cell-input" data-field="groupIds" value="${escapeAttr(joinIds(row.groupIds))}" placeholder="1,2,3"></td>
    <td class="preview">
      <div class="chip-row">${buildRowPreviewHtml(row.groupIds)}</div>
      <details class="script-detail"><summary>展开</summary>${buildScriptDetailHtml(row,idx,timing)}</details>
      <div class="chip-row" style="margin-top:4px">${warn.join("")}</div>
    </td>
    <td class="w-op">
      <div class="row-actions">
        <button type="button" data-action="pick">选鱼群</button>
        <button type="button" data-action="up">上移</button>
        <button type="button" data-action="down">下移</button>
        <button type="button" data-action="del">删除</button>
      </div>
    </td>
  </tr>`;
}

function buildRowPreviewHtml(groupIds){
  if(!groupIds.length) return `<span class="chip warn">无鱼群</span>`;
  const chips=[];
  for(const gid of groupIds.slice(0,4)){
    const g=state.groupMap.get(gid);
    if(!g){chips.push(`<span class="chip warn">G${gid}(未知)</span>`);continue;}
    const first=(g.composition||[]).slice(0,2).map(x=>`${x.cnName}x${x.count}@${x.payoutText}`).join(" / ");
    chips.push(`<span class="chip">${escapeHtml(`G${gid}: ${first}`)}</span>`);
  }
  if(groupIds.length>4) chips.push(`<span class="chip">...+${groupIds.length-4}</span>`);
  return chips.join("");
}

function buildGroupTiming(groupId){
  const g=state.groupMap.get(groupId);
  if(!g) return {groupId,exists:false,fishCount:0,groupFishGapMs:0,birthDurationMs:0,routeMaxSec:0,clearDurationMs:0,hasBoss:false,routeIds:[],fishList:[],routeCycleMs:[]};
  const fishList=getGroupFishList(g);
  const fishCount=fishList.length;
  const groupFishGapMs=Math.max(0,num(g.gapTime,0));
  const birthDurationMs=fishCount>0?Math.max(0,(fishCount-1)*groupFishGapMs):0;
  const routeCycleMs=(g.routeTimes||[]).map(x=>Math.max(0,Math.round((Number(x)||0)*1000))).filter(x=>x>0);
  const routeMaxSec=routeCycleMs.length?Math.max(...routeCycleMs)/1000:0;

  // Group clear time is the latest fish disappearance:
  // spawnOffset(i) + routeDuration(i), where routeDuration cycles by route order.
  let clearDurationMs=0;
  for(let i=0;i<fishCount;i++){
    const spawnOffset=i*groupFishGapMs;
    const routeDurationMs=routeCycleMs.length?routeCycleMs[i%routeCycleMs.length]:0;
    clearDurationMs=Math.max(clearDurationMs,spawnOffset+routeDurationMs);
  }
  return {
    groupId,exists:true,fishCount,groupFishGapMs,birthDurationMs,routeMaxSec,clearDurationMs,
    hasBoss:groupHasBoss(g),routeIds:g.routeIds||[],fishList,routeCycleMs
  };
}

function getMinAllowedGapByGroupIds(groupIds){
  if(!groupIds||groupIds.length<=1) return 0;
  let minGap=0;
  for(const groupId of groupIds.slice(0,-1)){
    const t=buildGroupTiming(groupId);
    minGap=Math.max(minGap,t.birthDurationMs);
  }
  return minGap;
}

function buildArenaRows(arenaId){
  const rows=state.scripts.map((row,scriptIndex)=>({...row,scriptIndex})).filter(row=>row.arenaIds.includes(arenaId));
  let cursor=0;
  const result=[];
  for(const row of rows){
    const rowGapMs=Math.max(0,row.gapTimeMs);
    const groupSchedule=row.groupIds.map((groupId,pos)=>{
      const gt=buildGroupTiming(groupId);
      const startMs=cursor+pos*rowGapMs;
      const bornDoneMs=startMs+gt.birthDurationMs;
      const clearDoneMs=startMs+gt.clearDurationMs;
      return {position:pos+1,groupId,...gt,startMs,bornDoneMs,clearDoneMs};
    });
    let minAllowedGapMs=0;
    for(let i=0;i<groupSchedule.length-1;i++) minAllowedGapMs=Math.max(minAllowedGapMs,groupSchedule[i].birthDurationMs);
    const spawnDoneMs=groupSchedule.length?Math.max(...groupSchedule.map(g=>g.bornDoneMs)):cursor;
    const clearDoneMs=groupSchedule.length?Math.max(...groupSchedule.map(g=>g.clearDoneMs)):cursor;
    result.push({
      scriptIndex:row.scriptIndex,scriptId:row.scriptId,groupIds:row.groupIds,rowGapMs,type:row.type,
      minAllowedGapMs,
      startMs:cursor,spawnDoneMs,clearDoneMs,rowSpawnDurationMs:Math.max(0,spawnDoneMs-cursor),rowClearDurationMs:Math.max(0,clearDoneMs-cursor),
      groupSchedule,fishPreview:buildFishPreviewLabels(row.groupIds).slice(0,10),
      tip:`Script ${row.scriptId} | 绝对开始:${formatSec(cursor)}s | Group间隔:${formatSec(rowGapMs)}s | 出生完成:${formatSec(spawnDoneMs)}s`
    });
    cursor=spawnDoneMs;
  }
  return result;
}

function buildSelectedArenaTiming(){
  const out={hasArena:Boolean(state.selectedArenaId),eventCount:0,totalSpawnMs:0,totalClearMs:0,startMap:new Map(),spawnDoneMap:new Map(),clearDoneMap:new Map(),groupScheduleMap:new Map()};
  if(!state.selectedArenaId) return out;
  const rows=buildArenaRows(state.selectedArenaId);
  out.eventCount=rows.length;
  out.totalSpawnMs=rows.length?rows[rows.length-1].spawnDoneMs:0;
  out.totalClearMs=rows.reduce((m,x)=>Math.max(m,x.clearDoneMs),0);
  for(const row of rows){
    out.startMap.set(row.scriptIndex,row.startMs);
    out.spawnDoneMap.set(row.scriptIndex,row.spawnDoneMs);
    out.clearDoneMap.set(row.scriptIndex,row.clearDoneMs);
    out.groupScheduleMap.set(row.scriptIndex,row.groupSchedule||[]);
  }
  return out;
}

function buildScriptDetailHtml(row,scriptIndex,timing){
  const startMs=timing.startMap.get(scriptIndex);
  const spawnDoneMs=timing.spawnDoneMap.get(scriptIndex);
  const clearDoneMs=timing.clearDoneMap.get(scriptIndex);
  const gs=timing.groupScheduleMap.get(scriptIndex)||[];
  const rowGapMs=Math.max(0,row.gapTimeMs);
  const minGapMs=gs.length>1?Math.max(0,...gs.slice(0,-1).map(g=>g.birthDurationMs)):0;
  const arenaTip=timing.hasArena?(startMs===undefined?"当前选中场次不包含本条脚本":`当前场次绝对开始: ${formatSec(startMs)}s，出生完成: ${formatSec(spawnDoneMs)}s，清场完成: ${formatSec(clearDoneMs)}s`):"未选择场次";
  const groupDetails=gs.map(g=>{
    const order=(g.fishList||[]).slice(0,18).map((f,i)=>`${i+1}.${f.cnFullName}(${f.payoutText}倍)`).join(" -> ");
    const routeCycle=(g.routeCycleMs||[]).map(ms=>`${formatSec(ms)}s`).join(" -> ");
    const more=(g.fishList||[]).length>18?" ...":"";
    return `<div class="script-detail-item"><div class="head">顺序 ${g.position} | Group ${g.groupId} | Boss:${g.hasBoss?"是":"否"} | Route:${escapeHtml(joinIds(g.routeIds))}</div><div class="order">绝对开始: ${formatSec(g.startMs)}s -> 出生完成: ${formatSec(g.bornDoneMs)}s -> 清场完成: ${formatSec(g.clearDoneMs)}s<br>组内鱼间隔: ${g.groupFishGapMs}ms | 鱼数量: ${g.fishCount} | 出生耗时: ${formatSec(g.birthDurationMs)}s | 清场耗时: ${formatSec(g.clearDurationMs)}s<br>路径轮转时长: ${escapeHtml(routeCycle||"无路径时长")}<br>${escapeHtml(order)}${more}</div></div>`;
  });
  const rowSpawn=startMs===undefined?null:Math.max(0,spawnDoneMs-startMs);
  const rowClear=startMs===undefined?null:Math.max(0,clearDoneMs-startMs);
  const rowDurTip=rowSpawn===null?"":"<br>本条出生耗时: "+formatSec(rowSpawn)+"s，本条清场耗时: "+formatSec(rowClear)+"s";
  return `<div class="script-detail-list"><div class="script-detail-item"><div class="head">本条脚本信息</div><div class="order">Group间隔(可调整): ${formatSec(rowGapMs)}s（${rowGapMs}ms）<br>最小可设间隔: ${formatSec(minGapMs)}s（上一组出生完成约束）<br>${escapeHtml(arenaTip)}${rowDurTip}<br>当前场次总出生耗时: ${formatSec(timing.totalSpawnMs)}s，清场耗时: ${formatSec(timing.totalClearMs)}s（事件数: ${timing.eventCount}）</div></div>${groupDetails.join("")||`<div class="script-detail-item"><div class="head">组顺序</div><div class="order">无可用 Group</div></div>`}</div>`;
}

function buildFishPreviewLabels(groupIds){
  const out=[];
  for(const gid of groupIds){
    const g=state.groupMap.get(gid);
    if(!g) continue;
    const comp=(g.composition||[]);
    if(comp.length){
      for(const item of comp){
        const label=`${item.cnName}(${item.payoutText}倍)`;
        if(!out.includes(label)) out.push(label);
        if(out.length>20) return out;
      }
    }else{
      for(const f of getGroupFishList(g)){
        const label=`${f.cnFullName}(${f.payoutText}倍)`;
        if(!out.includes(label)) out.push(label);
        if(out.length>20) return out;
      }
    }
  }
  return out;
}

function renderTimeline(){
  const arenaId=state.selectedArenaId;
  if(!arenaId){els.timelineSummary.innerHTML="";els.timelineTrack.innerHTML=`<p class="muted">请选择场次</p>`;els.timelineEvents.innerHTML="";return;}
  const rows=buildArenaRows(arenaId);
  if(!rows.length){els.timelineSummary.innerHTML="";els.timelineTrack.innerHTML=`<p class="muted">当前场次暂无脚本</p>`;els.timelineEvents.innerHTML="";return;}

  const totalSpawnMs=rows[rows.length-1].spawnDoneMs;
  const totalClearMs=rows.reduce((m,r)=>Math.max(m,r.clearDoneMs),0);
  const totalGapMs=rows.reduce((s,r)=>s+r.rowGapMs,0);
  const avgGapMs=totalGapMs/rows.length;
  const minGapRows=rows.filter(r=>r.groupSchedule.length>1).map(r=>r.minAllowedGapMs);
  const minGapAvg=minGapRows.length?minGapRows.reduce((a,b)=>a+b,0)/minGapRows.length:0;
  els.timelineSummary.innerHTML=[`<span class="item">脚本行: ${rows.length}</span>`,`<span class="item">总出生耗时: ${formatSec(totalSpawnMs)}s</span>`,`<span class="item">总清场耗时: ${formatSec(totalClearMs)}s</span>`,`<span class="item">平均Group间隔: ${formatSec(avgGapMs)}s</span>`,`<span class="item">平均最小间隔: ${formatSec(minGapAvg)}s</span>`].join("");

  const pxBase=state.viewMode==="cut"?totalSpawnMs:totalClearMs;
  const pxPerMs=clamp(920/Math.max(pxBase,1),0.0009,0.04);
  state.timelineScale.pxPerMs=pxPerMs;
  state.timelineScale.baseX=70;

  if(state.viewMode==="cut") renderCutTrack(rows,pxPerMs,totalSpawnMs);
  else renderOverlapTrack(rows,pxPerMs,totalClearMs);

  renderTimelineEvents(rows);
}

function renderCutTrack(rows,pxPerMs,totalSpawnMs){
  const baseX=state.timelineScale.baseX,laneH=36,top=22;
  const canvasW=Math.max(860,Math.round(totalSpawnMs*pxPerMs)+140);
  const canvasH=top+rows.length*laneH+20;

  const ticks=[];
  const step=niceTickStep(totalSpawnMs);
  for(let ms=0;ms<=totalSpawnMs;ms+=step){
    const x=baseX+ms*pxPerMs;
    ticks.push(`<div class="axis-tick" style="left:${x}px"><label>${formatSec(ms)}s</label></div>`);
  }

  const labels=[],clips=[],gaps=[];
  for(let r=0;r<rows.length;r++){
    const row=rows[r];
    const y=top+r*laneH;
    labels.push(`<div class="cut-row-label" style="top:${y+5}px">S${row.scriptId}</div>`);
    for(let i=0;i<row.groupSchedule.length;i++){
      const g=row.groupSchedule[i];
      const left=baseX+g.startMs*pxPerMs;
      const width=Math.max(22,g.birthDurationMs*pxPerMs);
      clips.push(`<div class="cut-clip ${g.hasBoss?"boss":""}" style="left:${left}px;top:${y}px;width:${width}px" title="Group ${g.groupId} | 固定出生耗时 ${formatSec(g.birthDurationMs)}s | 绝对开始 ${formatSec(g.startMs)}s | 出生完成 ${formatSec(g.bornDoneMs)}s">G${g.groupId}<span class="dur">${formatSec(g.birthDurationMs)}s</span></div>`);
      if(i<row.groupSchedule.length-1){
        const next=row.groupSchedule[i+1];
        const right=left+width;
        const left2=baseX+next.startMs*pxPerMs;
        const gapLeft=right;
        const gapW=Math.max(12,left2-gapLeft);
        gaps.push(`<div class="cut-gap" style="left:${gapLeft}px;top:${y+14}px;width:${gapW}px"><span class="gap-label">${row.rowGapMs}ms (>=${row.minAllowedGapMs}ms)</span><span class="gap-handle" style="left:${Math.max(0,gapW/2-5)}px" data-script-index="${row.scriptIndex}" title="拖动调整 Group间隔"></span></div>`);
      }
    }
  }

  els.timelineTrack.innerHTML=`<div class="timeline-canvas" style="width:${canvasW}px;height:${canvasH}px"><div class="timeline-axis"></div>${ticks.join("")}${labels.join("")}${gaps.join("")}${clips.join("")}</div>`;
}

function renderOverlapTrack(rows,pxPerMs,totalClearMs){
  const baseX=state.timelineScale.baseX;
  const all=[];
  for(const row of rows){
    for(const g of row.groupSchedule){
      all.push({scriptIndex:row.scriptIndex,scriptId:row.scriptId,groupId:g.groupId,hasBoss:g.hasBoss,startMs:g.startMs,bornDoneMs:g.bornDoneMs,clearDoneMs:g.clearDoneMs});
    }
  }
  all.sort((a,b)=>(a.startMs-b.startMs)||(a.clearDoneMs-b.clearDoneMs));

  const laneEnds=[];
  for(const ev of all){
    let lane=0;
    while(lane<laneEnds.length&&laneEnds[lane]>ev.startMs) lane++;
    if(lane===laneEnds.length) laneEnds.push(ev.clearDoneMs); else laneEnds[lane]=ev.clearDoneMs;
    ev.lane=lane;
  }

  const laneCount=Math.max(1,laneEnds.length),laneH=28,top=22;
  const canvasW=Math.max(860,Math.round(totalClearMs*pxPerMs)+140);
  const canvasH=top+laneCount*laneH+20;

  const ticks=[];
  const step=niceTickStep(totalClearMs);
  for(let ms=0;ms<=totalClearMs;ms+=step){
    const x=baseX+ms*pxPerMs;
    ticks.push(`<div class="axis-tick" style="left:${x}px"><label>${formatSec(ms)}s</label></div>`);
  }

  const labels=[];
  for(let lane=0;lane<laneCount;lane++) labels.push(`<div class="overlap-lane-label" style="top:${top+lane*laneH+5}px">Lane ${lane+1}</div>`);

  const bars=all.map(ev=>{
    const y=top+ev.lane*laneH;
    const left=baseX+ev.startMs*pxPerMs;
    const width=Math.max(16,(ev.clearDoneMs-ev.startMs)*pxPerMs);
    const born=Math.max(2,Math.min(width-2,(ev.bornDoneMs-ev.startMs)*pxPerMs));
    return `<div class="overlap-bar ${ev.hasBoss?"boss":""}" style="left:${left}px;top:${y}px;width:${width}px" title="S${ev.scriptId}/G${ev.groupId} | 绝对开始:${formatSec(ev.startMs)}s | 出生完成:${formatSec(ev.bornDoneMs)}s | 清场:${formatSec(ev.clearDoneMs)}s">S${ev.scriptId}-G${ev.groupId}<span class="overlap-born-marker" style="left:${born}px"></span><span class="gap-handle" data-script-index="${ev.scriptIndex}" title="拖动调整 Group间隔"></span></div>`;
  });

  els.timelineTrack.innerHTML=`<div class="timeline-canvas" style="width:${canvasW}px;height:${canvasH}px"><div class="timeline-axis"></div>${ticks.join("")}${labels.join("")}${bars.join("")}</div>`;
}

function renderTimelineEvents(rows){
  els.timelineEvents.innerHTML=rows.map(row=>{
    const fish=row.fishPreview.map(name=>`<span class="chip">${escapeHtml(name)}</span>`).join("");
    return `<div class="event-item"><h4>Script ${row.scriptId} | 绝对开始 ${formatSec(row.startMs)}s | 出生完成 ${formatSec(row.spawnDoneMs)}s | 清场完成 ${formatSec(row.clearDoneMs)}s</h4><div class="muted">本条出生耗时 ${formatSec(row.rowSpawnDurationMs)}s | 本条清场耗时 ${formatSec(row.rowClearDurationMs)}s | Group: ${escapeHtml(joinIds(row.groupIds))} | Group间隔 ${formatSec(row.rowGapMs)}s | Type: ${row.type}</div><div class="chip-row" style="margin-top:4px">${fish}</div></div>`;
  }).join("");
}

function niceTickStep(totalMs){
  const raw=Math.max(1000,totalMs/8);
  const c=[1000,2000,5000,10000,15000,20000,30000,60000,120000,180000,300000];
  for(const x of c) if(x>=raw) return x;
  return c[c.length-1];
}

function onTimelineMouseDown(ev){
  const handle=ev.target.closest(".gap-handle");
  if(!handle) return;
  const scriptIndex=num(handle.dataset.scriptIndex,-1);
  if(scriptIndex<0||!state.scripts[scriptIndex]) return;
  state.gapDrag.active=true;
  state.gapDrag.scriptIndex=scriptIndex;
  state.gapDrag.startX=ev.clientX;
  state.gapDrag.startGapMs=state.scripts[scriptIndex].gapTimeMs;
  state.gapDrag.pxPerMs=Math.max(0.0001,state.timelineScale.pxPerMs);
  document.body.classList.add("resizing-gap");
  ev.preventDefault();
}

function onTimelineMouseMove(ev){
  if(!state.gapDrag.active) return;
  const idx=state.gapDrag.scriptIndex;
  if(idx<0||!state.scripts[idx]) return;
  const delta=ev.clientX-state.gapDrag.startX;
  const raw=state.gapDrag.startGapMs+delta/state.gapDrag.pxPerMs;
  const minGapMs=getScriptMinAllowedGapMs(idx);
  const next=Math.max(minGapMs,Math.round(raw/50)*50);
  if(next===state.scripts[idx].gapTimeMs) return;
  state.scripts[idx].gapTimeMs=next;
  renderTimeline();
}

function onTimelineMouseUp(){
  if(!state.gapDrag.active) return;
  state.gapDrag.active=false;
  state.gapDrag.scriptIndex=-1;
  document.body.classList.remove("resizing-gap");
  renderScriptTable();
  renderTimeline();
  toast("已调整 Group间隔（受上一组出生完成点约束）");
}

function getScriptMinAllowedGapMs(scriptIndex){
  const row=state.scripts[scriptIndex];
  if(!row) return 0;
  return getMinAllowedGapByGroupIds(row.groupIds);
}

function onScriptInput(ev){
  const input=ev.target;
  const tr=input.closest("tr[data-idx]");
  if(!tr) return;
  const idx=Number(tr.dataset.idx);
  const field=input.dataset.field;
  if(!state.scripts[idx]||!field) return;
  if(field==="groupIds"||field==="arenaIds") state.scripts[idx][field]=parseIds(input.value);
  else if(field==="scriptId"||field==="type") state.scripts[idx][field]=num(input.value,0);
  else if(field==="gapTimeMs"){
    const raw=Math.max(0,num(input.value,0));
    state.scripts[idx].gapTimeMs=Math.max(raw,getScriptMinAllowedGapMs(idx));
    input.value=String(state.scripts[idx].gapTimeMs);
  }
  renderScriptTable();
  renderTimeline();
}

function onScriptActions(ev){
  const btn=ev.target.closest("button[data-action]");
  if(!btn) return;
  const tr=btn.closest("tr[data-idx]");
  if(!tr) return;
  const idx=Number(tr.dataset.idx);
  const action=btn.dataset.action;
  if(action==="del") state.scripts.splice(idx,1);
  else if(action==="up"&&idx>0) [state.scripts[idx-1],state.scripts[idx]]=[state.scripts[idx],state.scripts[idx-1]];
  else if(action==="down"&&idx<state.scripts.length-1) [state.scripts[idx+1],state.scripts[idx]]=[state.scripts[idx],state.scripts[idx+1]];
  else if(action==="pick"){openPicker(idx);return;}
  renderScriptTable();
  renderTimeline();
}

function onRowDragStart(ev){
  const handle=ev.target.closest(".drag-handle");
  if(!handle) return;
  const fromIdx=Number(handle.dataset.dragIdx);
  if(!Number.isInteger(fromIdx)) return;
  state.dragFromIndex=fromIdx;state.dragOverIndex=-1;
  const tr=handle.closest("tr");if(tr) tr.classList.add("dragging");
  if(ev.dataTransfer){ev.dataTransfer.effectAllowed="move";ev.dataTransfer.setData("text/plain",String(fromIdx));}
}

function onRowDragOver(ev){
  if(state.dragFromIndex<0) return;
  const tr=ev.target.closest("tr[data-idx]");
  if(!tr) return;
  ev.preventDefault();
  for(const node of els.scriptTbody.querySelectorAll("tr.drop-target")) node.classList.remove("drop-target");
  tr.classList.add("drop-target");
  state.dragOverIndex=Number(tr.dataset.idx);
}

function onRowDrop(ev){
  if(state.dragFromIndex<0) return;
  const tr=ev.target.closest("tr[data-idx]");
  if(!tr) return;
  ev.preventDefault();
  const from=state.dragFromIndex,rawTo=Number(tr.dataset.idx);
  if(from===rawTo||from<0||rawTo<0){clearDragState();return;}
  const item=state.scripts.splice(from,1)[0];
  const to=rawTo>from?rawTo-1:rawTo;
  state.scripts.splice(to,0,item);
  clearDragState();
  renderScriptTable();
  renderTimeline();
  toast("已拖拽调整顺序");
}

function clearDragState(){
  state.dragFromIndex=-1;state.dragOverIndex=-1;
  for(const node of els.scriptTbody.querySelectorAll("tr.dragging, tr.drop-target")) node.classList.remove("dragging","drop-target");
}

function addScriptRow(){
  const maxId=state.scripts.reduce((m,r)=>Math.max(m,r.scriptId),0);
  const firstArena=state.arenas[0]?[state.arenas[0].id]:[];
  state.scripts.push({scriptId:maxId+1,gapTimeMs:3000,arenaIds:firstArena,type:1,groupIds:[]});
  renderScriptTable();
  renderTimeline();
}

function sortScriptsById(){
  state.scripts.sort((a,b)=>a.scriptId-b.scriptId);
  renderScriptTable();
  renderTimeline();
  toast("已按 ScriptId 排序");
}

function openPicker(rowIndex){
  const row=state.scripts[rowIndex];
  if(!row) return;
  state.pickerRowIndex=rowIndex;
  state.pickerSelected=new Set(row.groupIds);
  state.pickerBossFilter="all";
  els.pickerBossFilter.value="all";
  els.pickerSearch.value="";
  els.pickerRowInfo.textContent=`当前 ScriptId: ${row.scriptId}，已选 ${row.groupIds.length} 个 Group`;
  renderPickerList();
  els.groupPicker.showModal();
}

function renderPickerList(){
  const list=filterGroups(els.pickerSearch.value,state.pickerBossFilter);
  if(!list.length){els.pickerList.innerHTML=`<p class="muted">无匹配鱼群</p>`;return;}
  els.pickerList.innerHTML=list.map(g=>{
    const hasBoss=groupHasBoss(g);
    const checked=state.pickerSelected.has(g.id)?"checked":"";
    const fish=(g.composition||[]).slice(0,8).map(f=>`<span class="chip">${escapeHtml(`${f.cnName} x${f.count} @${f.payoutText}`)}</span>`).join("");
    return `<label class="picker-item"><input type="checkbox" data-group-id="${g.id}" ${checked}><div><div><b>Group ${g.id}</b> ${hasBoss?`<span class="chip warn">Boss</span>`:`<span class="chip">Normal</span>`} | Avg赔率:${g.avgPayout} | Route:${escapeHtml(joinIds(g.routeIds||[]))}</div><div class="chip-row" style="margin-top:4px">${fish}</div></div></label>`;
  }).join("");
}

function onPickerChange(ev){
  const target=ev.target;
  if(!target.matches("input[type='checkbox'][data-group-id]")) return;
  const groupId=Number(target.dataset.groupId);
  if(!groupId) return;
  if(target.checked) state.pickerSelected.add(groupId); else state.pickerSelected.delete(groupId);
}

function applyPicker(){
  const idx=state.pickerRowIndex;
  if(idx<0||!state.scripts[idx]) return;
  state.scripts[idx].groupIds=Array.from(state.pickerSelected).sort((a,b)=>a-b);
  els.groupPicker.close();
  renderScriptTable();
  renderTimeline();
}

async function postJson(url,body){
  const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body||{})});
  const data=await res.json();
  if(!data.ok) throw new Error(data.error||"请求失败");
  return data;
}

async function loadPresetList(preferName){
  try{
    const res=await fetch("/api/presets");
    const data=await res.json();
    if(!data.ok) throw new Error(data.error||"读取方案列表失败");
    state.presets=Array.isArray(data.presets)?data.presets:[];
    const names=state.presets.map(x=>x.name);
    if(preferName&&names.includes(preferName)) state.selectedPresetName=preferName;
    else if(state.selectedPresetName&&names.includes(state.selectedPresetName)){}
    else state.selectedPresetName=names[0]||"";
    renderPresetSelect();
  }catch(err){
    state.presets=[];
    renderPresetSelect();
    toast(`方案列表读取失败: ${err.message}`,true);
  }
}

function renderPresetSelect(){
  if(!els.presetSelect) return;
  if(!state.presets.length){
    els.presetSelect.innerHTML=`<option value="">(无本地方案)</option>`;
    return;
  }
  els.presetSelect.innerHTML=state.presets.map(p=>{
    const title=[p.name,p.rows?`(${p.rows}行)`:"",p.createdAt?`@${p.createdAt}`:""].filter(Boolean).join(" ");
    return `<option value="${escapeAttr(p.name)}" ${p.name===state.selectedPresetName?"selected":""}>${escapeHtml(title)}</option>`;
  }).join("");
}

async function onPresetSaveCurrent(){
  const defaultName=`方案_${new Date().toISOString().replace(/[:T]/g,"-").slice(0,16)}`;
  const name=(window.prompt("保存方案名称",defaultName)||"").trim();
  if(!name) return;
  try{
    const data=await postJson("/api/preset/save",{name,scripts:state.scripts,meta:{source:"manual",tableDir:state.tableDir}});
    await loadPresetList(data.name);
    if(Array.isArray(data.warnings)&&data.warnings.length) toast(`方案已保存(${data.rows}行)，有${data.warnings.length}条警告`,true);
    else toast(`方案已保存: ${data.name}`);
  }catch(err){toast(`保存方案失败: ${err.message}`,true);}
}

async function onPresetLoad(){
  const name=state.selectedPresetName||els.presetSelect.value;
  if(!name){toast("请先选择方案",true);return;}
  try{
    const data=await postJson("/api/preset/load",{name});
    state.scripts=(data.scripts||[]).map(normalizeScriptRow);
    state.selectedPresetName=name;
    renderPresetSelect();
    renderScriptTable();
    renderTimeline();
    toast(`已加载方案: ${name} (${state.scripts.length}行)`);
  }catch(err){toast(`加载方案失败: ${err.message}`,true);}
}

async function onPresetDelete(){
  const name=state.selectedPresetName||els.presetSelect.value;
  if(!name){toast("请先选择方案",true);return;}
  if(!window.confirm(`确定删除本地方案 "${name}" 吗？`)) return;
  try{
    await postJson("/api/preset/delete",{name});
    state.selectedPresetName="";
    await loadPresetList("");
    toast(`已删除方案: ${name}`);
  }catch(err){toast(`删除方案失败: ${err.message}`,true);}
}

function collectConfiguredGroupsForArena(arenaId){
  const ids=[];
  for(const row of state.scripts){
    if(!row.arenaIds.includes(arenaId)) continue;
    for(const gid of row.groupIds) if(gid>0) ids.push(gid);
  }
  return uniq(ids).map(id=>state.groupMap.get(id)).filter(Boolean).filter(g=>groupFishCount(g)>0);
}

function buildBossGroupMapByArena(){
  const result=new Map();
  for(const row of state.scripts){
    const bossIds=row.groupIds.filter(gid=>groupHasBoss(state.groupMap.get(gid)));
    if(!bossIds.length) continue;
    const lastBoss=bossIds[bossIds.length-1];
    for(const arenaId of row.arenaIds){
      if(!result.has(arenaId)) result.set(arenaId,new Map());
      const countMap=result.get(arenaId);
      countMap.set(lastBoss,(countMap.get(lastBoss)||0)+1);
    }
  }
  return result;
}

function chooseBossForArena(arenaId,bossMap,bossPool){
  if(!bossPool.length) return null;
  const countMap=bossMap.get(arenaId);
  const sorted=bossPool.slice().sort((a,b)=>{
    const prefA=countMap?countMap.get(a.id)||0:0;
    const prefB=countMap?countMap.get(b.id)||0:0;
    if(prefA!==prefB) return prefB-prefA;
    const payA=num(a.avgPayout,0);
    const payB=num(b.avgPayout,0);
    if(payA!==payB) return payB-payA;
    return a.id-b.id;
  });
  return sorted[0].id;
}

function splitByPayout(groups){
  if(!groups.length) return {low:[],mid:[],high:[]};
  const sorted=groups.slice().sort((a,b)=>num(a.avgPayout,0)-num(b.avgPayout,0));
  const n=sorted.length;
  const i1=Math.max(1,Math.floor(n*0.34));
  const i2=Math.max(i1+1,Math.floor(n*0.67));
  const low=sorted.slice(0,i1);
  const mid=sorted.slice(i1,i2);
  const high=sorted.slice(i2);
  return {
    low:low.length?low:sorted.slice(0,Math.max(1,Math.ceil(n/3))),
    mid:mid.length?mid:sorted.slice(0,Math.max(1,Math.ceil(n/2))),
    high:high.length?high:sorted.slice(Math.max(0,n-Math.max(1,Math.ceil(n/3))))
  };
}

function pickBalancedFromPool(pool,count,usedInScript,usageMap,cursorMap,cursorKey){
  const out=[];
  if(!pool.length||count<=0) return out;
  for(let i=0;i<count;i++){
    let candidates=pool.filter(g=>!usedInScript.has(g.id));
    if(!candidates.length) candidates=pool.slice();
    const minUse=Math.min(...candidates.map(g=>usageMap.get(g.id)||0));
    const leastUsed=candidates.filter(g=>(usageMap.get(g.id)||0)===minUse).sort((a,b)=>a.id-b.id);
    const cursor=cursorMap.get(cursorKey)||0;
    const chosen=leastUsed[cursor%leastUsed.length];
    cursorMap.set(cursorKey,cursor+1);
    out.push(chosen);
    usageMap.set(chosen.id,(usageMap.get(chosen.id)||0)+1);
    usedInScript.add(chosen.id);
  }
  return out;
}

function pickSingleDeterministic(pool,usedInScript,usageMap,cursorMap,key,banned){
  if(!pool.length) return null;
  const bannedSet=new Set(banned||[]);
  let candidates=pool.filter(g=>!usedInScript.has(g.id)&&!bannedSet.has(g.id));
  if(!candidates.length) candidates=pool.filter(g=>!bannedSet.has(g.id));
  if(!candidates.length) candidates=pool.slice();
  const minUse=Math.min(...candidates.map(g=>usageMap.get(g.id)||0));
  const leastUsed=candidates.filter(g=>(usageMap.get(g.id)||0)===minUse).sort((a,b)=>a.id-b.id);
  const cursor=cursorMap.get(key)||0;
  const chosen=leastUsed[cursor%leastUsed.length];
  cursorMap.set(key,cursor+1);
  usageMap.set(chosen.id,(usageMap.get(chosen.id)||0)+1);
  usedInScript.add(chosen.id);
  return chosen;
}

function buildStagePattern(index,total){
  const p=total<=1?1:index/(total-1);
  if(p<0.2) return {low:4,mid:2,high:0};
  if(p<0.45) return {low:3,mid:3,high:1};
  if(p<0.7) return {low:2,mid:3,high:2};
  return {low:1,mid:2,high:3};
}

function buildGapMs(index,total){
  if(total<=1) return 2600;
  const p=index/(total-1);
  // Three-phase pacing: calm -> pressure -> climax
  if(p<0.35){
    const x=p/0.35;
    return Math.round((3600-(x*800))/100)*100;
  }
  if(p<0.75){
    const x=(p-0.35)/0.4;
    return Math.round((2800-(x*700))/100)*100;
  }
  const x=(p-0.75)/0.25;
  return Math.round((2200-(x*300))/100)*100;
}

function generateScriptsForAllArenas(minPerArena){
  if(!state.arenas.length) return {scripts:[],issues:["无可用渔场"]};

  const bossMap=buildBossGroupMapByArena();

  let nextId=state.scripts.reduce((m,r)=>Math.max(m,r.scriptId),0)+1;
  const out=[];
  const issues=[];

  for(const arena of state.arenas){
    const configured=collectConfiguredGroupsForArena(arena.id);
    const bossPool=configured.filter(g=>groupHasBoss(g));
    const normalPool=configured.filter(g=>!groupHasBoss(g));
    if(!configured.length){
      issues.push(`Arena ${arena.id} 未配置任何可用Group`);
      continue;
    }
    if(!bossPool.length){
      issues.push(`Arena ${arena.id} 缺少Boss组（只在当前已配置组内生成）`);
      continue;
    }
    if(!normalPool.length){
      issues.push(`Arena ${arena.id} 缺少普通组（只在当前已配置组内生成）`);
      continue;
    }

    const scriptCount=Math.max(minPerArena,Math.min(8,Math.round(normalPool.length/4)+3));
    const payoutBands=splitByPayout(normalPool);
    const skillPool=normalPool.filter(g=>Boolean(g.hasSkill));
    const lowIds=new Set(payoutBands.low.map(x=>x.id));
    const highIds=new Set((payoutBands.high.length?payoutBands.high:payoutBands.mid).map(x=>x.id));
    const usageMap=new Map();
    const cursorMap=new Map();
    const bossGroupId=chooseBossForArena(arena.id,bossMap,bossPool);
    if(!bossGroupId){
      issues.push(`Arena ${arena.id} 无可用Boss组`);
      continue;
    }
    let prevTail=-1;
    let prevHead=-1;

    for(let i=0;i<scriptCount;i++){
      const pattern=buildStagePattern(i,scriptCount);
      const used=new Set();
      const low=pickBalancedFromPool(payoutBands.low,pattern.low,used,usageMap,cursorMap,`a${arena.id}-low`);
      const middlePool=payoutBands.mid.length?payoutBands.mid:payoutBands.low;
      const mid=pickBalancedFromPool(middlePool,pattern.mid,used,usageMap,cursorMap,`a${arena.id}-mid`);
      const highPool=payoutBands.high.length?payoutBands.high:middlePool;
      const high=pickBalancedFromPool(highPool,pattern.high,used,usageMap,cursorMap,`a${arena.id}-high`);
      const finalStage=high.map(x=>x.id);

      // Mid/Late phase insert one skill group as a pattern breaker.
      if(i>=Math.floor(scriptCount*0.35)&&i<scriptCount-1&&skillPool.length){
        const skill=pickSingleDeterministic(skillPool,used,usageMap,cursorMap,`a${arena.id}-skill`,[prevTail,prevHead]);
        if(skill){
          const pos=Math.max(1,Math.floor(finalStage.length/2));
          finalStage.splice(pos,0,skill.id);
        }
      }

      // Boss appears once per arena, in the last script's final stage (not necessarily the final slot).
      if(i===scriptCount-1){
        const insertAt=finalStage.length<=1?finalStage.length:Math.max(1,Math.floor(finalStage.length/2));
        finalStage.splice(insertAt,0,bossGroupId);
      }

      let seq=[...low,...mid].map(x=>x.id).concat(finalStage);

      // Add a relief low-payout group before final stage in non-ending scripts.
      if(i<scriptCount-1&&seq.length>=4){
        const relief=pickSingleDeterministic(payoutBands.low,used,usageMap,cursorMap,`a${arena.id}-relief`,[prevTail,prevHead]);
        if(relief){
          const reliefPos=Math.max(2,seq.length-2);
          seq.splice(reliefPos,0,relief.id);
        }
      }

      // Avoid repeated head/tail and long high-payout streaks.
      if(seq.length&&seq[0]===prevHead){
        const alt=pickSingleDeterministic(payoutBands.low,used,usageMap,cursorMap,`a${arena.id}-alt-head`,[seq[0],prevTail]);
        if(alt) seq[0]=alt.id;
      }
      if(seq.length>2&&seq[seq.length-1]===prevTail&&i<scriptCount-1){
        const altTail=pickSingleDeterministic(middlePool,used,usageMap,cursorMap,`a${arena.id}-alt-tail`,[seq[seq.length-1],bossGroupId]);
        if(altTail) seq[seq.length-1]=altTail.id;
      }
      let highStreak=0;
      for(let k=0;k<seq.length;k++){
        const gid=seq[k];
        if(highIds.has(gid)&&gid!==bossGroupId) highStreak+=1; else highStreak=0;
        if(highStreak>=3&&k<seq.length-1){
          const relief=pickSingleDeterministic(payoutBands.low,used,usageMap,cursorMap,`a${arena.id}-streak-break`,[gid,bossGroupId]);
          if(relief) seq.splice(k,0,relief.id);
          highStreak=0;
        }
      }

      if(!seq.length) continue;
      prevHead=seq[0];
      prevTail=seq[seq.length-1];
      out.push({
        scriptId:nextId++,
        gapTimeMs:buildGapMs(i,scriptCount),
        arenaIds:[arena.id],
        type:seq.includes(bossGroupId)?2:1,
        groupIds:seq
      });
    }
  }
  return {scripts:out,issues};
}

async function tryGenerateByModel(minPerArena,llmConfig){
  try{
    console.log("[AI-REQ-JSON] /api/generate-script-ai\n"+JSON.stringify({minPerArena,llmConfig},null,2));
  }catch(_e){
    console.log("[AI-REQ] /api/generate-script-ai payload =",{minPerArena,llmConfig});
  }
  try{
    const res=await fetch("/api/generate-script-ai",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({minPerArena,llmConfig})
    });
    let data;
    try{data=await res.json();}catch(_e){data={ok:false,error:`HTTP ${res.status} 非JSON响应`};}
    try{
      console.log("[AI-RES-JSON] /api/generate-script-ai\n"+JSON.stringify(data,null,2));
    }catch(_e){
      console.log("[AI-RES] /api/generate-script-ai response =",data);
    }
    if(Array.isArray(data.debug)){
      for(const item of data.debug){
        if(!item||typeof item!=="object") continue;
        if(typeof item.content==="string"){
          console.log(`[AI-DEBUG] ${item.title||"untitled"}\n${item.content}`);
        }else{
          try{
            console.log(`[AI-DEBUG] ${item.title||"untitled"}\n${JSON.stringify(item.content,null,2)}`);
          }catch(_e){
            console.log(`[AI-DEBUG] ${item.title||"untitled"}`,item.content);
          }
        }
      }
    }else{
      console.warn("[AI-DEBUG] 服务端未返回debug字段，可能是旧版本服务未重启");
    }
    if(!data.ok) throw new Error(data.error||`HTTP ${res.status}`);
    const scripts=Array.isArray(data.scripts)?data.scripts:[];
    if(!scripts.length) throw new Error("大模型返回空结果");
    return {ok:true,scripts,model:data.model||"",notes:data.notes||""};
  }catch(err){
    console.error("[AI-ERR] /api/generate-script-ai",err);
    return {ok:false,error:err.message||"大模型生成失败"};
  }
}

async function onAutoGenerateScripts(){
  const llmCfg=getLLMRequestConfig();
  const minPerArena=Math.max(3,Math.round(llmCfg.minPerArena||6));
  const mode=llmCfg.mode||"auto";
  saveLLMConfig(false);
  if(!state.arenas.length||!state.groups.length){
    toast("数据未加载完成，请先点“重新读取表”",true);
    return;
  }
  let generatedResult;
  let sourceTag="smart-rule";
  const runLocal=()=>{generatedResult=generateScriptsForAllArenas(minPerArena);sourceTag="smart-rule";};
  if(mode==="local"){
    runLocal();
    toast("已使用本地算法生成");
  }else{
    const aiResult=await tryGenerateByModel(minPerArena,llmCfg);
    if(aiResult.ok){
      generatedResult={scripts:(aiResult.scripts||[]),issues:[]};
      sourceTag=`llm:${aiResult.model||"unknown"}`;
      if(aiResult.notes) toast(`大模型生成完成：${aiResult.notes}`);
    }else if(mode==="auto"){
      runLocal();
      toast(`大模型不可用，已回退本地算法：${aiResult.error}`,true);
    }else{
      toast(`仅大模型模式失败：${aiResult.error}`,true);
      return;
    }
  }
  const generated=generatedResult.scripts||[];
  if(!generated.length){
    const reason=(generatedResult.issues||[]).slice(0,2).join("；");
    toast(`自动生成失败：${reason||"当前配置不足"}`,true);
    return;
  }
  if((generatedResult.issues||[]).length){
    toast(`部分渔场跳过：${generatedResult.issues[0]}`,true);
  }
  const msg=`将替换当前脚本为智能生成结果（每场至少${minPerArena}套，共${generated.length}行）。是否继续？`;
  if(!window.confirm(msg)) return;
  state.scripts=generated;
  renderScriptTable();
  renderTimeline();
  renderGenerateReport(generated);
  toast(`已自动生成 ${generated.length} 行脚本`);

  const autoName=`自动生成_${new Date().toISOString().replace(/[:T]/g,"-").slice(0,16)}`;
  try{
    const data=await postJson("/api/preset/save",{name:autoName,scripts:state.scripts,meta:{source:sourceTag,minPerArena}});
    await loadPresetList(data.name);
  }catch(err){
    toast(`自动方案保存失败: ${err.message}`,true);
  }
}

async function saveScripts(outputFile){
  try{
    const body={outputFile,scripts:state.scripts.map(r=>({scriptId:num(r.scriptId,0),gapTimeMs:Math.max(0,num(r.gapTimeMs,0)),arenaIds:parseIds(r.arenaIds),type:num(r.type,1),groupIds:parseIds(r.groupIds)}))};
    const res=await fetch("/api/save-script",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const data=await res.json();
    if(!data.ok) throw new Error(data.error||"保存失败");
    const baseNote=(data.basePreserved&&data.baseFile)?`（基准 ${data.baseFile} 未修改）`:"";
    if(Array.isArray(data.warnings)&&data.warnings.length){
      toast(`已保存 ${data.savedFile}，但有 ${data.warnings.length} 条警告${baseNote}`,true);
      console.warn(data.warnings);
    }else{
      toast(`已保存: ${data.savedFile}${baseNote}`);
    }
  }catch(err){toast(`保存失败: ${err.message}`,true);}
}

function onSaveAs(){
  const input=window.prompt("请输入新文件名（自动追加时间戳，不会覆盖 Script&.xlsx）","Script.visual.generated.xlsx");
  if(!input) return;
  saveScripts(input.trim());
}

function parseIds(value){
  if(Array.isArray(value)) return uniq(value.map(x=>num(x,0)).filter(x=>x>0));
  if(typeof value==="number") return value>0?[value]:[];
  return uniq(String(value||"").split(",").map(t=>num(t.trim(),0)).filter(n=>n>0));
}

function toBool(v){
  if(typeof v==="boolean") return v;
  if(typeof v==="number") return v!==0;
  if(typeof v==="string"){
    const s=v.trim().toLowerCase();
    if(s==="true"||s==="1"||s==="yes"||s==="y"||s==="boss") return true;
    if(s==="false"||s==="0"||s==="no"||s==="n"||s==="normal"||s==="") return false;
  }
  return Boolean(v);
}

function groupHasBoss(g){
  if(!g) return false;
  if(g.hasBoss!==undefined&&g.hasBoss!==null) return toBool(g.hasBoss);
  return getGroupFishList(g).some(f=>num(f.fishType,0)>=100);
}

function joinIds(ids){return (ids||[]).join(",");}
function formatSec(ms){return (Math.max(0,ms)/1000).toFixed(2);}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?Math.trunc(n):d;}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function uniq(arr){return Array.from(new Set(arr));}

function escapeHtml(str){
  return String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function escapeAttr(str){return escapeHtml(str).replaceAll("'","&#39;");}

let toastTimer=null;
function toast(message,isWarn=false){
  els.toast.textContent=message;
  els.toast.style.background=isWarn?"#7a1f2a":"#102a43";
  els.toast.classList.add("show");
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>els.toast.classList.remove("show"),2400);
}
