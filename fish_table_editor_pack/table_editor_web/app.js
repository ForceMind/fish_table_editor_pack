"use strict";

const state={
  tableDir:"",logicHint:{},arenas:[],fish:[],groups:[],routes:[],scripts:[],
  groupMap:new Map(),fishMap:new Map(),selectedArenaId:null,
  viewMode:"cut",leftBossFilter:"all",pickerBossFilter:"all",
  pickerRowIndex:-1,pickerSelected:new Set(),dragFromIndex:-1,dragOverIndex:-1,
  presets:[],selectedPresetName:"",
  llmConfig:{
    mode:"auto",minPerArena:6,
    baseUrl:"https://api.openai.com/v1",model:"gpt-4.1-mini",apiKey:"",temperature:0.2,maxTokens:2048,
    templateShuffle:55,templateTrim:25,templateCandidates:8,minConcurrentFish:12,maxConcurrentFish:45
  },
  timelineScale:{pxPerMs:0.005,baseX:70},
  gapDrag:{active:false,scriptIndex:-1,startX:0,startGapMs:0,pxPerMs:0.005},
  aiReview:{busy:false,candidateScripts:[],validatedScripts:[],sourceTag:"",minPerArena:6,lastRequest:null,lastResponse:null,debugItems:[]}
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
  genTemplateShuffle:document.getElementById("gen-template-shuffle"),
  genTemplateTrim:document.getElementById("gen-template-trim"),
  genTemplateCandidates:document.getElementById("gen-template-candidates"),
  genMinConcurrentFish:document.getElementById("gen-min-concurrent-fish"),
  genMaxConcurrentFish:document.getElementById("gen-max-concurrent-fish"),
  llmBaseUrl:document.getElementById("llm-base-url"),llmModel:document.getElementById("llm-model"),
  llmApiKey:document.getElementById("llm-api-key"),llmTemperature:document.getElementById("llm-temperature"),llmMaxTokens:document.getElementById("llm-max-tokens"),
  groupPicker:document.getElementById("group-picker"),pickerRowInfo:document.getElementById("picker-row-info"),
  pickerSearch:document.getElementById("picker-search"),pickerBossFilter:document.getElementById("picker-boss-filter"),
  pickerList:document.getElementById("picker-list"),toast:document.getElementById("toast"),
  aiDialog:document.getElementById("ai-review-dialog"),aiReviewClose:document.getElementById("ai-review-close"),
  aiReviewCancel:document.getElementById("ai-review-cancel"),aiStatusBadge:document.getElementById("ai-status-badge"),
  aiStatusLog:document.getElementById("ai-status-log"),aiRequestJson:document.getElementById("ai-request-json"),
  aiRawJson:document.getElementById("ai-raw-json"),aiEditJson:document.getElementById("ai-edit-json"),
  aiValidateMsg:document.getElementById("ai-validate-msg"),aiValidateBtn:document.getElementById("ai-validate-btn"),
  aiFormatBtn:document.getElementById("ai-format-btn"),aiApplyBtn:document.getElementById("ai-apply-btn"),
  aiRegenerateBtn:document.getElementById("ai-regenerate-btn")
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
  for(const node of [els.genMode,els.genMinPerArena,els.genTemplateShuffle,els.genTemplateTrim,els.genTemplateCandidates,els.genMinConcurrentFish,els.genMaxConcurrentFish,els.llmBaseUrl,els.llmModel,els.llmApiKey,els.llmTemperature,els.llmMaxTokens]){
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

  if(els.aiReviewClose) els.aiReviewClose.addEventListener("click",closeAIReviewDialog);
  if(els.aiReviewCancel) els.aiReviewCancel.addEventListener("click",closeAIReviewDialog);
  if(els.aiDialog){
    els.aiDialog.addEventListener("cancel",(evt)=>{
      if(state.aiReview.busy){
        evt.preventDefault();
        toast("AI生成中，请稍候完成。",true);
      }
    });
  }
  if(els.aiValidateBtn) els.aiValidateBtn.addEventListener("click",()=>validateReviewEditor(true));
  if(els.aiFormatBtn) els.aiFormatBtn.addEventListener("click",formatReviewEditorJson);
  if(els.aiApplyBtn) els.aiApplyBtn.addEventListener("click",applyReviewScripts);
  if(els.aiRegenerateBtn) els.aiRegenerateBtn.addEventListener("click",()=>{
    pushAIStatus("手动触发重新生成...");
    onAutoGenerateScripts("manual-regenerate");
  });
  if(els.aiEditJson) els.aiEditJson.addEventListener("input",()=>{
    if(els.aiApplyBtn) els.aiApplyBtn.disabled=true;
    state.aiReview.validatedScripts=[];
    setAIValidateMessage("JSON已修改，请重新校验。",false);
  });
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
    templateShuffle:Math.round(clampNum(els.genTemplateShuffle?.value,0,100,55)),
    templateTrim:Math.round(clampNum(els.genTemplateTrim?.value,0,70,25)),
    templateCandidates:Math.round(clampNum(els.genTemplateCandidates?.value,1,20,8)),
    minConcurrentFish:Math.round(clampNum(els.genMinConcurrentFish?.value,5,60,12)),
    maxConcurrentFish:Math.round(clampNum(els.genMaxConcurrentFish?.value,10,120,45)),
    baseUrl:(els.llmBaseUrl?.value||"https://api.openai.com/v1").trim(),
    model:(els.llmModel?.value||"gpt-4.1-mini").trim(),
    apiKey:(els.llmApiKey?.value||"").trim(),
    temperature:clampNum(els.llmTemperature?.value,0,1,0.2),
    maxTokens:Math.round(clampNum(els.llmMaxTokens?.value,512,131072,2048))
  };
}

function applyLLMConfigToInputs(){
  if(els.genMode) els.genMode.value=state.llmConfig.mode||"auto";
  if(els.genMinPerArena) els.genMinPerArena.value=String(state.llmConfig.minPerArena||6);
  if(els.genTemplateShuffle) els.genTemplateShuffle.value=String(Math.round(clampNum(state.llmConfig.templateShuffle,0,100,55)));
  if(els.genTemplateTrim) els.genTemplateTrim.value=String(Math.round(clampNum(state.llmConfig.templateTrim,0,70,25)));
  if(els.genTemplateCandidates) els.genTemplateCandidates.value=String(Math.round(clampNum(state.llmConfig.templateCandidates,1,20,8)));
  if(els.genMinConcurrentFish) els.genMinConcurrentFish.value=String(Math.round(clampNum(state.llmConfig.minConcurrentFish,5,60,12)));
  if(els.genMaxConcurrentFish) els.genMaxConcurrentFish.value=String(Math.round(clampNum(state.llmConfig.maxConcurrentFish,10,120,45)));
  if(els.llmBaseUrl) els.llmBaseUrl.value=state.llmConfig.baseUrl||"https://api.openai.com/v1";
  if(els.llmModel) els.llmModel.value=state.llmConfig.model||"gpt-4.1-mini";
  if(els.llmApiKey) els.llmApiKey.value=state.llmConfig.apiKey||"";
  if(els.llmTemperature) els.llmTemperature.value=String(state.llmConfig.temperature??0.2);
  if(els.llmMaxTokens) els.llmMaxTokens.value=String(Math.round(clampNum(state.llmConfig.maxTokens,512,131072,2048)));
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
    templateShuffle:Math.round(clampNum(state.llmConfig.templateShuffle,0,100,55)),
    templateTrim:Math.round(clampNum(state.llmConfig.templateTrim,0,70,25)),
    templateCandidates:Math.round(clampNum(state.llmConfig.templateCandidates,1,20,8)),
    minConcurrentFish:Math.round(clampNum(state.llmConfig.minConcurrentFish,5,60,12)),
    maxConcurrentFish:Math.round(clampNum(state.llmConfig.maxConcurrentFish,10,120,45)),
    baseUrl:(state.llmConfig.baseUrl||"https://api.openai.com/v1").trim(),
    model:(state.llmConfig.model||"gpt-4.1-mini").trim(),
    apiKey:(state.llmConfig.apiKey||"").trim(),
    temperature:clampNum(state.llmConfig.temperature,0,1,0.2),
    maxTokens:Math.round(clampNum(state.llmConfig.maxTokens,512,131072,2048))
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

function openAIReviewDialog(){
  if(!els.aiDialog) return;
  if(els.aiDialog.open) return;
  if(typeof els.aiDialog.showModal==="function") els.aiDialog.showModal();
}

function closeAIReviewDialog(){
  if(!els.aiDialog) return;
  if(state.aiReview.busy){
    toast("AI生成中，请稍候完成。",true);
    return;
  }
  els.aiDialog.close();
}

function aiTimeLabel(){
  try{
    return new Date().toLocaleTimeString("zh-CN",{hour12:false});
  }catch(_e){
    return new Date().toISOString();
  }
}

function setAIStatusBadge(text,isWarn){
  if(!els.aiStatusBadge) return;
  els.aiStatusBadge.textContent=text||"";
  els.aiStatusBadge.classList.toggle("warn",Boolean(isWarn));
}

function pushAIStatus(message,isWarn=false){
  if(!els.aiStatusLog) return;
  const line=document.createElement("div");
  line.className=`ai-status-line${isWarn?" warn":""}`;
  line.textContent=`[${aiTimeLabel()}] ${message}`;
  els.aiStatusLog.appendChild(line);
  els.aiStatusLog.scrollTop=els.aiStatusLog.scrollHeight;
}

function setAIValidateMessage(message,isWarn){
  if(!els.aiValidateMsg) return;
  els.aiValidateMsg.textContent=message||"";
  els.aiValidateMsg.className=`muted ${isWarn?"ai-validate-warn":"ai-validate-ok"}`.trim();
}

function resetAIReviewDialog(requestPayload){
  state.aiReview.candidateScripts=[];
  state.aiReview.validatedScripts=[];
  state.aiReview.sourceTag="";
  state.aiReview.lastRequest=requestPayload||null;
  state.aiReview.lastResponse=null;
  state.aiReview.debugItems=[];
  if(els.aiStatusLog) els.aiStatusLog.innerHTML="";
  refreshAIRequestPreview();
  if(els.aiRawJson) els.aiRawJson.value="";
  if(els.aiEditJson) els.aiEditJson.value="";
  if(els.aiApplyBtn) els.aiApplyBtn.disabled=true;
  setAIStatusBadge("准备请求",false);
  setAIValidateMessage("等待结果。",false);
}

function maskApiKey(value){
  const key=String(value||"").trim();
  if(!key) return "";
  return key.length>=4?`***${key.slice(-4)}`:"***";
}

function buildAISystemPromptPreview(){
  return [
    "你是资深捕鱼策划，需要输出可落地的脚本编排JSON。",
    "目标：让对局有节奏、有波峰、有缓冲，且满足工程约束。",
    "硬约束：",
    "1) 每个arena至少minScripts条；",
    "2) 只可使用该arena提供的groups id，不可发明新id；",
    "3) 每个arena Boss恰好出现1次；且必须在该arena最后一条脚本的后半段（不要求最后一个）；",
    "4) 赔率节奏：前期低赔率占优，中期均衡，后期高赔率占优；",
    "5) gapTimeMs要随阶段逐步收紧，整体呈加压感；",
    "6) scriptId从startScriptId开始全局递增且唯一；type规则：若该行含Boss组则type=2，否则type=1。",
    "风格要求：不要机械重复同一组，避免连续多条都高赔率轰炸，保证可玩性。",
    "输出格式要求：只输出一个合法JSON对象；不要markdown，不要代码块，不要注释。",
    "输出只允许一个JSON对象，结构：",
    "{\"scripts\":[{\"scriptId\":123,\"gapTimeMs\":2600,\"arenaIds\":[1],\"type\":1,\"groupIds\":[1,2,3]}],\"notes\":\"一句话说明策略\"}"
  ].join("");
}

function buildSafeRequestPayload(minPerArena,llmCfg,requestId){
  const safeCfg={...(llmCfg||{})};
  if(Object.prototype.hasOwnProperty.call(safeCfg,"apiKey")) safeCfg.apiKey=maskApiKey(safeCfg.apiKey);
  return {
    requestId:requestId||`req-${Date.now()}`,
    requestedAt:new Date().toISOString(),
    minPerArena,
    llmConfig:safeCfg,
    systemPromptPreview:buildAISystemPromptPreview()
  };
}

function dedupeByString(values){
  const out=[];
  const seen=new Set();
  for(const item of Array.isArray(values)?values:[]){
    const key=typeof item==="string"?item:JSON.stringify(item);
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function parseJsonLoose(text){
  const raw=String(text||"").trim();
  if(!raw) return null;
  try{return JSON.parse(raw);}catch(_e){return null;}
}

function extractFirstAttemptUserPayload(attempts){
  const firstAttempt=(Array.isArray(attempts)?attempts:[]).find(x=>String(x?.title||"").includes("first-attempt"))||(Array.isArray(attempts)?attempts[0]:null);
  const body=firstAttempt?.body;
  if(!body||typeof body!=="object") return {attempt:firstAttempt||null,userPayload:null};
  const messages=Array.isArray(body.messages)?body.messages:[];
  const userMsg=messages.find(msg=>msg&&msg.role==="user");
  const userContent=(userMsg&&typeof userMsg.content!=="undefined")?userMsg.content:"";
  const parsed=typeof userContent==="string"?parseJsonLoose(userContent):userContent;
  return {attempt:firstAttempt||null,userPayload:parsed||userContent||null};
}

function buildLocalBaseDataSnapshot(){
  return {
    arenas:{count:state.arenas.length,sample:state.arenas.slice(0,3).map(a=>({id:a.id,name:a.name}))},
    groups:{count:state.groups.length,sample:state.groups.slice(0,5).map(g=>({id:g.id,avgPayout:g.avgPayout,hasBoss:Boolean(g.hasBoss),hasSkill:Boolean(g.hasSkill)}))},
    fish:{count:state.fish.length},
    routes:{count:state.routes.length},
    scripts:{count:state.scripts.length,sample:state.scripts.slice(0,3).map(s=>({scriptId:s.scriptId,arenaIds:parseIds(s.arenaIds),groupIds:parseIds(s.groupIds).slice(0,8)}))}
  };
}

function extractRequestDebug(debugItems){
  const endpoint=[];
  const prompt=[];
  const attempts=[];
  let generationContext=null;
  const arenaContexts=[];
  for(const item of Array.isArray(debugItems)?debugItems:[]){
    if(!item||typeof item!=="object") continue;
    const title=String(item.title||"");
    if(title.includes("AI endpoint")) endpoint.push(item.content);
    if(title.includes("AI system prompt")) prompt.push(item.content);
    if(title.includes("AI request payload")) attempts.push({title,body:item.content});
    if(title==="AI generation context") generationContext=item.content;
    if(title.startsWith("AI arena context[")) arenaContexts.push({title,context:item.content});
  }
  return {
    endpoint:dedupeByString(endpoint),
    prompt:dedupeByString(prompt),
    attempts,
    generationContext,
    arenaContexts
  };
}

function refreshAIRequestPreview(){
  if(!els.aiRequestJson) return;
  const details=extractRequestDebug(state.aiReview.debugItems);
  const fallbackPrompt=state.aiReview.lastRequest?.systemPromptPreview||"";
  const promptText=(details.prompt&&details.prompt.length)?details.prompt[0]:fallbackPrompt;
  const attemptDetail=extractFirstAttemptUserPayload(details.attempts);
  const payload={
    clientRequest:state.aiReview.lastRequest||null,
    localBaseDataSnapshot:buildLocalBaseDataSnapshot(),
    serverContextBuilt:{
      generationContext:details.generationContext,
      arenaContexts:details.arenaContexts
    },
    openaiRequest:{
      endpoint:(details.endpoint&&details.endpoint.length)?details.endpoint[0]:null,
      systemPrompt:promptText,
      firstAttemptBody:attemptDetail.attempt?.body||null,
      firstAttemptUserPayload:attemptDetail.userPayload
    }
  };
  els.aiRequestJson.textContent=JSON.stringify(payload,null,2);
}

function setAIReviewBusy(busy){
  state.aiReview.busy=Boolean(busy);
  if(els.aiRegenerateBtn) els.aiRegenerateBtn.disabled=state.aiReview.busy;
  if(els.aiValidateBtn) els.aiValidateBtn.disabled=state.aiReview.busy;
  if(els.aiFormatBtn) els.aiFormatBtn.disabled=state.aiReview.busy;
  if(els.aiApplyBtn) els.aiApplyBtn.disabled=state.aiReview.busy||!state.aiReview.validatedScripts.length;
}

function setReviewRawResponse(payload){
  state.aiReview.lastResponse=payload||null;
  if(!els.aiRawJson) return;
  if(payload===undefined||payload===null){
    els.aiRawJson.value="";
    return;
  }
  try{
    els.aiRawJson.value=JSON.stringify(payload,null,2);
  }catch(_e){
    els.aiRawJson.value=String(payload);
  }
}

function setReviewEditorPayload(payload){
  if(!els.aiEditJson) return;
  try{
    els.aiEditJson.value=JSON.stringify(payload,null,2);
  }catch(_e){
    els.aiEditJson.value=String(payload||"");
  }
}

function extractFirstJsonBlock(text){
  const source=String(text||"");
  let start=-1;
  let startChar="";
  const objIndex=source.indexOf("{");
  const arrIndex=source.indexOf("[");
  if(objIndex<0&&arrIndex<0) return "";
  if(objIndex>=0&&(arrIndex<0||objIndex<arrIndex)){start=objIndex;startChar="{";}
  else{start=arrIndex;startChar="[";}
  const stack=[startChar];
  let inString=false;
  let escaped=false;
  for(let i=start+1;i<source.length;i++){
    const ch=source[i];
    if(inString){
      if(escaped){escaped=false;continue;}
      if(ch==="\\"){escaped=true;continue;}
      if(ch==="\""){inString=false;}
      continue;
    }
    if(ch==="\""){inString=true;continue;}
    if(ch==="{"||ch==="["){stack.push(ch);continue;}
    if(ch==="}"||ch==="]"){
      const top=stack[stack.length-1];
      if((top==="{"&&ch==="}")||(top==="["&&ch==="]")){
        stack.pop();
        if(!stack.length) return source.slice(start,i+1);
      }
    }
  }
  return "";
}

function parseReviewJsonText(text){
  const raw=String(text||"").trim();
  if(!raw) return {ok:false,error:"JSON为空"};
  const tryParse=(s)=>JSON.parse(s);
  let parsed;
  let sourceTag="editor.raw";
  try{
    parsed=tryParse(raw);
  }catch(_e){
    const fenced=raw.startsWith("```")?raw.replace(/^```[a-zA-Z]*\s*/,"").replace(/```$/,"").trim():raw;
    if(fenced!==raw){
      try{
        parsed=tryParse(fenced);
        sourceTag="editor.fenced";
      }catch(_e2){}
    }
    if(parsed===undefined){
      const block=extractFirstJsonBlock(raw);
      if(!block) return {ok:false,error:"未识别到合法JSON对象/数组"};
      try{
        parsed=tryParse(block);
        sourceTag="editor.extracted";
      }catch(err){
        return {ok:false,error:`JSON解析失败: ${err.message}`};
      }
    }
  }

  let scripts=null;
  if(Array.isArray(parsed)) scripts=parsed;
  else if(parsed&&typeof parsed==="object"){
    if(Array.isArray(parsed.scripts)) scripts=parsed.scripts;
    else if(parsed.result&&Array.isArray(parsed.result.scripts)) scripts=parsed.result.scripts;
    else if(parsed.data&&Array.isArray(parsed.data.scripts)) scripts=parsed.data.scripts;
  }
  if(!Array.isArray(scripts)) return {ok:false,error:"JSON中未找到scripts数组"};

  const normalized=[];
  const issues=[];
  scripts.forEach((row,idx)=>{
    const n=normalizeScriptRow(row||{});
    n.type=n.type===2?2:1;
    if(n.scriptId<=0){issues.push(`第${idx+1}行 scriptId 非法`);return;}
    if(!n.groupIds.length){issues.push(`第${idx+1}行 groupIds 为空`);return;}
    if(!n.arenaIds.length){issues.push(`第${idx+1}行 arenaIds 为空`);return;}
    normalized.push(n);
  });
  if(!normalized.length) return {ok:false,error:"scripts无有效行"};

  const arenaMap=new Map();
  normalized.forEach((row)=>{
    const aid=row.arenaIds[0]||0;
    if(!arenaMap.has(aid)) arenaMap.set(aid,{rows:0,type2:0});
    const st=arenaMap.get(aid);
    st.rows+=1;
    if(row.type===2) st.type2+=1;
  });
  const summary=Array.from(arenaMap.entries()).sort((a,b)=>a[0]-b[0]).map(([aid,st])=>`Arena${aid}: ${st.rows}条,Type2=${st.type2}`).join(" | ");
  return {ok:true,parsed,sourceTag,scripts:normalized,issues,summary};
}

function validateReviewEditor(showToast){
  const parsed=parseReviewJsonText(els.aiEditJson?els.aiEditJson.value:"");
  if(!parsed.ok){
    state.aiReview.validatedScripts=[];
    if(els.aiApplyBtn) els.aiApplyBtn.disabled=true;
    setAIValidateMessage(parsed.error,true);
    if(showToast) toast(`JSON校验失败: ${parsed.error}`,true);
    return parsed;
  }
  state.aiReview.validatedScripts=parsed.scripts;
  if(els.aiApplyBtn) els.aiApplyBtn.disabled=state.aiReview.busy||!parsed.scripts.length;
  const issueText=parsed.issues.length?`；过滤${parsed.issues.length}条无效行`:"";
  setAIValidateMessage(`已识别 ${parsed.scripts.length} 条脚本（${parsed.summary}${issueText}）`,false);
  if(showToast) toast(`JSON校验通过：${parsed.scripts.length}条`);
  return parsed;
}

function formatReviewEditorJson(){
  const parsed=parseReviewJsonText(els.aiEditJson?els.aiEditJson.value:"");
  if(!parsed.ok){
    setAIValidateMessage(parsed.error,true);
    toast(`格式化失败: ${parsed.error}`,true);
    return;
  }
  setReviewEditorPayload({scripts:parsed.scripts});
  validateReviewEditor(false);
}

async function applyReviewScripts(){
  if(state.aiReview.busy){
    toast("AI仍在执行，请稍候。",true);
    return;
  }
  const checked=validateReviewEditor(true);
  if(!checked.ok) return;
  const rows=checked.scripts||[];
  const msg=`将使用审核后的 ${rows.length} 行脚本替换当前编辑区，是否继续？`;
  if(!window.confirm(msg)) return;

  state.scripts=rows;
  renderScriptTable();
  renderTimeline();
  renderGenerateReport(rows);
  toast(`已应用 ${rows.length} 行脚本`);

  const sourceTag=state.aiReview.sourceTag||"review-json";
  const minPerArena=state.aiReview.minPerArena||6;
  const autoName=`自动生成_${new Date().toISOString().replace(/[:T]/g,"-").slice(0,16)}`;
  try{
    const data=await postJson("/api/preset/save",{name:autoName,scripts:state.scripts,meta:{source:sourceTag,minPerArena}});
    await loadPresetList(data.name);
    pushAIStatus(`已保存本地方案：${data.name||autoName}`);
  }catch(err){
    pushAIStatus(`自动方案保存失败: ${err.message}`,true);
    toast(`自动方案保存失败: ${err.message}`,true);
  }
  closeAIReviewDialog();
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

function createSeededRng(seed){
  let t=(Number(seed)||0)>>>0;
  return ()=>{
    t+=0x6D2B79F5;
    let v=Math.imul(t^(t>>>15),1|t);
    v^=v+Math.imul(v^(v>>>7),61|v);
    return ((v^(v>>>14))>>>0)/4294967296;
  };
}

function randomInt(rng,min,max){
  if(max<=min) return min;
  const r=typeof rng==="function"?rng():Math.random();
  return min+Math.floor(r*(max-min+1));
}

function shuffleArray(arr,rng){
  const out=arr.slice();
  for(let i=out.length-1;i>0;i--){
    const j=randomInt(rng,0,i);
    const tmp=out[i];
    out[i]=out[j];
    out[j]=tmp;
  }
  return out;
}

function pickBalancedFromPoolWithRng(pool,count,usedInScript,usageMap,cursorMap,cursorKey,rng){
  const out=[];
  if(!pool.length||count<=0) return out;
  for(let i=0;i<count;i++){
    let candidates=pool.filter(g=>!usedInScript.has(g.id));
    if(!candidates.length) candidates=pool.slice();
    const minUse=Math.min(...candidates.map(g=>usageMap.get(g.id)||0));
    const leastUsed=shuffleArray(
      candidates.filter(g=>(usageMap.get(g.id)||0)===minUse).sort((a,b)=>a.id-b.id),
      rng
    );
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

function pickSingleWithRng(pool,usedInScript,usageMap,cursorMap,key,banned,rng){
  if(!pool.length) return null;
  const bannedSet=new Set(banned||[]);
  let candidates=pool.filter(g=>!usedInScript.has(g.id)&&!bannedSet.has(g.id));
  if(!candidates.length) candidates=pool.filter(g=>!bannedSet.has(g.id));
  if(!candidates.length) candidates=pool.slice();
  const minUse=Math.min(...candidates.map(g=>usageMap.get(g.id)||0));
  const leastUsed=shuffleArray(
    candidates.filter(g=>(usageMap.get(g.id)||0)===minUse).sort((a,b)=>a.id-b.id),
    rng
  );
  const cursor=cursorMap.get(key)||0;
  const chosen=leastUsed[cursor%leastUsed.length];
  cursorMap.set(key,cursor+1);
  usageMap.set(chosen.id,(usageMap.get(chosen.id)||0)+1);
  usedInScript.add(chosen.id);
  return chosen;
}

function buildStagePattern(index,total){
  const p=total<=1?1:index/(total-1);
  if(p<0.2) return {low:3,mid:2,high:1};
  if(p<0.45) return {low:3,mid:2,high:2};
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

function estimateGroupDurationMs(groupId){
  const g=state.groupMap.get(groupId);
  if(!g) return 2500;
  const avgSec=num(g.avgRouteTime,0);
  if(avgSec>0) return clamp(Math.round(avgSec*1000),1000,12000);
  const routeTimes=Array.isArray(g.routeTimes)?g.routeTimes.map(x=>Number(x)||0).filter(x=>x>0):[];
  if(routeTimes.length){
    const maxSec=Math.max(...routeTimes);
    return clamp(Math.round(maxSec*1000),1000,12000);
  }
  return 2500;
}

function calcMaxConcurrentFish(groupIds,gapMs){
  const ids=Array.isArray(groupIds)?groupIds:[];
  if(!ids.length) return 0;
  const events=[];
  for(let i=0;i<ids.length;i++){
    const gid=ids[i];
    const g=state.groupMap.get(gid);
    const fishCount=Math.max(1,groupFishCount(g));
    const start=i*Math.max(0,num(gapMs,0));
    const end=start+estimateGroupDurationMs(gid);
    events.push({t:start,delta:+fishCount});
    events.push({t:end,delta:-fishCount});
  }
  events.sort((a,b)=>a.t===b.t?a.delta-b.delta:a.t-b.t);
  let current=0;
  let peak=0;
  for(const e of events){
    current+=e.delta;
    if(current>peak) peak=current;
  }
  return peak;
}

function groupAvgPayoutById(groupId){
  const g=state.groupMap.get(groupId);
  return num(g?.avgPayout,0);
}

function ensureLowHighCombo(seq,lowPool,high20Pool,normalPool,usageMap,cursorMap,keyPrefix,rng,bossGroupId){
  let out=(Array.isArray(seq)?seq:[]).slice();
  const used=new Set(out);
  const fallbackHigh=normalPool.slice().sort((a,b)=>num(b.avgPayout,0)-num(a.avgPayout,0));
  const highSource=high20Pool.length?high20Pool:fallbackHigh;

  let keepHighId=out.find(gid=>groupAvgPayoutById(gid)>=20)||0;
  let keepLowId=out.find(gid=>groupAvgPayoutById(gid)<20&&gid!==bossGroupId)||0;

  if(!keepHighId&&highSource.length){
    const highPick=pickSingleWithRng(highSource,used,usageMap,cursorMap,`${keyPrefix}-force-high`,[bossGroupId],rng);
    if(highPick){
      const pos=Math.max(1,Math.floor(out.length*0.6));
      out.splice(Math.min(pos,out.length),0,highPick.id);
      keepHighId=highPick.id;
    }
  }

  if(!keepLowId&&lowPool.length){
    const lowPick=pickSingleWithRng(lowPool,used,usageMap,cursorMap,`${keyPrefix}-force-low`,[bossGroupId],rng);
    if(lowPick){
      const pos=Math.min(1,out.length);
      out.splice(pos,0,lowPick.id);
      keepLowId=lowPick.id;
    }
  }

  return {seq:out,keepHighId,keepLowId};
}

function ensureBossNotTail(seq,bossGroupId,normalPool,usageMap,cursorMap,keyPrefix,rng){
  let out=(Array.isArray(seq)?seq:[]).slice();
  if(!out.includes(bossGroupId)) return out;
  const nonBossPool=normalPool.filter(g=>g.id!==bossGroupId);
  const used=new Set(out);

  while(out.length<4&&nonBossPool.length){
    const pick=pickSingleWithRng(nonBossPool,used,usageMap,cursorMap,`${keyPrefix}-pad-tail`,[bossGroupId],rng);
    if(!pick) break;
    out.push(pick.id);
  }

  let bossIdx=out.indexOf(bossGroupId);
  if(bossIdx>=out.length-2){
    out.splice(bossIdx,1);
    const target=Math.max(1,out.length-3);
    out.splice(target,0,bossGroupId);
  }

  while(out.indexOf(bossGroupId)>=out.length-2&&nonBossPool.length){
    const pick=pickSingleWithRng(nonBossPool,used,usageMap,cursorMap,`${keyPrefix}-append-tail`,[bossGroupId],rng);
    if(!pick) break;
    out.push(pick.id);
  }
  return out;
}

function constrainSequenceByFishCap(groupIds,gapMs,maxFish,bossGroupId,mustKeepSet){
  let seq=(Array.isArray(groupIds)?groupIds:[]).slice();
  const cap=Math.max(1,num(maxFish,50));
  const keep=mustKeepSet instanceof Set?mustKeepSet:new Set();
  for(let guard=0;guard<96;guard++){
    const peak=calcMaxConcurrentFish(seq,gapMs);
    if(peak<=cap) break;
    let removeIdx=-1;
    let removeFish=-1;
    for(let i=0;i<seq.length;i++){
      const gid=seq[i];
      if(gid===bossGroupId) continue;
      if(keep.has(gid)) continue;
      const fish=Math.max(1,groupFishCount(state.groupMap.get(gid)));
      if(fish>removeFish){
        removeFish=fish;
        removeIdx=i;
      }
    }
    if(removeIdx<0) break;
    seq.splice(removeIdx,1);
    if(!seq.length) break;
  }
  return seq;
}

function collectBaseRowsForArena(arenaId){
  const rows=[];
  for(const row of state.scripts){
    const arenaIds=parseIds(row.arenaIds);
    if(!arenaIds.includes(arenaId)) continue;
    rows.push(normalizeScriptRow(row));
  }
  return rows;
}

function pickBossFromArenaRows(rows,configuredPool){
  const counter=new Map();
  for(const row of rows){
    for(const gid of parseIds(row.groupIds)){
      if(!groupHasBoss(state.groupMap.get(gid))) continue;
      counter.set(gid,(counter.get(gid)||0)+1);
    }
  }
  if(counter.size){
    const ranked=Array.from(counter.entries()).sort((a,b)=>{
      if(a[1]!==b[1]) return b[1]-a[1];
      const pa=groupAvgPayoutById(a[0]);
      const pb=groupAvgPayoutById(b[0]);
      if(pa!==pb) return pb-pa;
      return a[0]-b[0];
    });
    return ranked[0][0];
  }
  const fallback=(Array.isArray(configuredPool)?configuredPool:[])
    .map(g=>g.id)
    .filter(id=>groupHasBoss(state.groupMap.get(id)))
    .sort((a,b)=>groupAvgPayoutById(b)-groupAvgPayoutById(a));
  return fallback[0]||0;
}

function shuffleByStrength(seq,strength,rng){
  const out=(Array.isArray(seq)?seq:[]).slice();
  if(out.length<2) return out;
  const s=clamp(num(strength,55),0,100);
  const swaps=Math.max(1,Math.round((out.length-1)*(s/28)));
  for(let i=0;i<swaps;i++){
    const a=randomInt(rng,0,out.length-1);
    const b=randomInt(rng,0,out.length-1);
    if(a===b) continue;
    const tmp=out[a];
    out[a]=out[b];
    out[b]=tmp;
  }
  return out;
}

function interleaveLowHigh(sortedAsc){
  const arr=(Array.isArray(sortedAsc)?sortedAsc:[]).slice();
  if(arr.length<=2) return arr;
  const out=[];
  let i=0;
  let j=arr.length-1;
  while(i<=j){
    out.push(arr[i]);
    i+=1;
    if(i<=j){
      out.push(arr[j]);
      j-=1;
    }
  }
  return out;
}

function reorderByStagePayout(seq,progress,rng,bossGroupId){
  const groups=(Array.isArray(seq)?seq:[]).filter(gid=>gid>0);
  if(!groups.length) return [];
  const p=clamp(Number(progress)||0,0,1);
  const boss=groups.filter(gid=>gid===bossGroupId);
  const normal=groups.filter(gid=>gid!==bossGroupId);
  const sortedAsc=normal.slice().sort((a,b)=>{
    const pa=groupAvgPayoutById(a)+(typeof rng==="function"?rng()*0.35:0);
    const pb=groupAvgPayoutById(b)+(typeof rng==="function"?rng()*0.35:0);
    if(pa!==pb) return pa-pb;
    return a-b;
  });
  let ordered=sortedAsc;
  if(p>=0.72){
    ordered=sortedAsc.slice().reverse();
  }else if(p>=0.38){
    ordered=interleaveLowHigh(sortedAsc);
  }
  return ordered.concat(boss);
}

function trimSequenceByRatio(seq,trimRatio,rng,mustKeepSet){
  const out=(Array.isArray(seq)?seq:[]).slice();
  if(out.length<=1) return out;
  const keep=mustKeepSet instanceof Set?mustKeepSet:new Set();
  const ratio=clamp(num(trimRatio,25),0,70)/100;
  const targetLen=Math.max(1,Math.round(out.length*(1-ratio)));
  let removeNeed=Math.max(0,out.length-targetLen);
  while(removeNeed>0&&out.length>1){
    const removable=[];
    for(let i=0;i<out.length;i++){
      if(keep.has(out[i])) continue;
      removable.push(i);
    }
    if(!removable.length) break;
    const ridx=removable[randomInt(rng,0,removable.length-1)];
    out.splice(ridx,1);
    removeNeed-=1;
  }
  return out;
}

function reduceNeighborRepeats(seq,arenaPool,rng,bossGroupId){
  const out=(Array.isArray(seq)?seq:[]).slice();
  const pool=(Array.isArray(arenaPool)?arenaPool:[]).filter(gid=>gid>0);
  if(out.length<2||!pool.length) return out;
  for(let i=1;i<out.length;i++){
    if(out[i]!==out[i-1]) continue;
    const candidates=pool.filter(gid=>gid!==out[i-1]&&gid!==bossGroupId);
    if(!candidates.length) continue;
    out[i]=candidates[randomInt(rng,0,candidates.length-1)];
  }
  return out;
}

function enforceBossFinalRule(rows,bossGroupId,arenaPool,rng){
  const out=(Array.isArray(rows)?rows:[]).map(row=>({
    scriptId:num(row.scriptId,0),
    gapTimeMs:Math.max(0,num(row.gapTimeMs,0)),
    arenaIds:parseIds(row.arenaIds),
    type:num(row.type,1),
    groupIds:parseIds(row.groupIds)
  }));
  if(!out.length||bossGroupId<=0) return out;
  for(const row of out){
    row.groupIds=row.groupIds.filter(gid=>gid!==bossGroupId);
  }
  const last=out[out.length-1];
  const nonBossPool=(Array.isArray(arenaPool)?arenaPool:[]).filter(gid=>gid!==bossGroupId);
  while(last.groupIds.length<2&&nonBossPool.length){
    last.groupIds.push(nonBossPool[randomInt(rng,0,nonBossPool.length-1)]);
  }
  const insertPos=Math.min(last.groupIds.length,Math.max(1,Math.floor((last.groupIds.length+1)/2)));
  last.groupIds.splice(insertPos,0,bossGroupId);
  for(const row of out){
    row.type=row.groupIds.includes(bossGroupId)?2:1;
  }
  return out;
}

function evaluateTemplateArenaRows(rows,bossGroupId){
  const flat=[];
  const payouts=[];
  const peaks=[];
  for(const row of rows){
    const gids=parseIds(row.groupIds);
    for(const gid of gids){
      flat.push(gid);
      payouts.push(groupAvgPayoutById(gid));
    }
    peaks.push(calcMaxConcurrentFish(gids,row.gapTimeMs));
  }
  const total=Math.max(1,flat.length);
  const uniqueRatio=(new Set(flat)).size/total;
  let repeatCount=0;
  for(let i=1;i<flat.length;i++){
    if(flat[i]===flat[i-1]) repeatCount+=1;
  }
  const repeatScore=1-(repeatCount/Math.max(1,total-1));
  const mid=Math.max(1,Math.floor(payouts.length/2));
  const earlyAvg=payouts.slice(0,mid).reduce((a,b)=>a+b,0)/Math.max(1,mid);
  const lateAvg=payouts.slice(mid).reduce((a,b)=>a+b,0)/Math.max(1,payouts.length-mid);
  const tension=((lateAvg-earlyAvg)/Math.max(1,Math.abs(earlyAvg)+Math.abs(lateAvg)+1))+0.5;
  const tensionScore=clamp(tension,0,1);
  const bossHits=flat.filter(gid=>gid===bossGroupId).length;
  const lastIds=parseIds(rows[rows.length-1]?.groupIds||[]);
  const bossPos=lastIds.indexOf(bossGroupId);
  const bossOk=bossHits===1&&bossPos>=Math.max(1,Math.floor(lastIds.length/2));
  const avgPeak=peaks.length?peaks.reduce((a,b)=>a+b,0)/peaks.length:0;
  const pressureScore=clamp((55-avgPeak)/35,0,1);
  const scoreRaw=
    uniqueRatio*0.30+
    repeatScore*0.22+
    tensionScore*0.22+
    (bossOk?1:0)*0.16+
    pressureScore*0.10;
  return {
    score:Math.round(clamp(scoreRaw,0,1)*100),
    metrics:{
      uniqueRatio:Number(uniqueRatio.toFixed(3)),
      repeatScore:Number(repeatScore.toFixed(3)),
      tensionScore:Number(tensionScore.toFixed(3)),
      bossOk,
      avgPeak:Number(avgPeak.toFixed(2))
    }
  };
}

function generateTemplateCandidate(minPerArena,templateOptions,seed){
  const rng=createSeededRng(seed);
  const minRows=Math.max(1,num(minPerArena,6));
  const shuffleStrength=clamp(num(templateOptions?.templateShuffle,55),0,100);
  const trimRatio=clamp(num(templateOptions?.templateTrim,25),0,70);
  let nextId=state.scripts.reduce((m,r)=>Math.max(m,r.scriptId),0)+1;
  const scripts=[];
  const issues=[`seed=${seed}`];
  const arenaScores=[];
  const arenaMetrics=[];

  for(const arena of state.arenas){
    const baseRows=collectBaseRowsForArena(arena.id);
    if(!baseRows.length){
      issues.push(`Arena ${arena.id} 缺少基础脚本，已跳过`);
      continue;
    }
    const configuredPool=collectConfiguredGroupsForArena(arena.id);
    const arenaPool=uniq(
      baseRows
        .flatMap(row=>parseIds(row.groupIds))
        .filter(gid=>gid>0)
    );
    if(!arenaPool.length){
      issues.push(`Arena ${arena.id} 基础脚本没有有效Group，已跳过`);
      continue;
    }
    const bossGroupId=pickBossFromArenaRows(baseRows,configuredPool);
    const rowCount=Math.max(minRows,baseRows.length);
    const arenaRows=[];
    for(let i=0;i<rowCount;i++){
      const base=baseRows[i%baseRows.length];
      let groupIds=parseIds(base.groupIds);
      if(!groupIds.length){
        groupIds=[arenaPool[randomInt(rng,0,arenaPool.length-1)]];
      }
      const progress=rowCount<=1?1:i/(rowCount-1);
      groupIds=shuffleByStrength(groupIds,shuffleStrength,rng);
      groupIds=reorderByStagePayout(groupIds,progress,rng,bossGroupId);
      const mustKeep=new Set();
      if(i===rowCount-1&&bossGroupId>0) mustKeep.add(bossGroupId);
      groupIds=trimSequenceByRatio(groupIds,trimRatio,rng,mustKeep);
      if(i<rowCount-1&&bossGroupId>0){
        groupIds=groupIds.filter(gid=>gid!==bossGroupId);
      }
      if(!groupIds.length){
        const fallback=arenaPool.filter(gid=>gid!==bossGroupId);
        groupIds=[(fallback.length?fallback:arenaPool)[randomInt(rng,0,(fallback.length?fallback:arenaPool).length-1)]];
      }
      groupIds=reduceNeighborRepeats(groupIds,arenaPool,rng,bossGroupId);
      const stageGap=buildGapMs(i,rowCount);
      const baseGap=Math.max(0,num(base.gapTimeMs,0));
      const gapMs=Math.round(clamp((baseGap*0.38)+(stageGap*0.62),700,4800)/50)*50;
      arenaRows.push({
        scriptId:nextId++,
        gapTimeMs:gapMs,
        arenaIds:[arena.id],
        type:1,
        groupIds
      });
    }
    const finalRows=enforceBossFinalRule(arenaRows,bossGroupId,arenaPool,rng);
    const evalResult=evaluateTemplateArenaRows(finalRows,bossGroupId);
    arenaScores.push(Math.max(0,bestArenaEval.score));
    arenaMetrics.push({arenaId:arena.id,...evalResult.metrics});
    scripts.push(...finalRows);
  }

  const score=arenaScores.length?Math.round(arenaScores.reduce((a,b)=>a+b,0)/arenaScores.length):0;
  return {scripts,issues,score,seed,metrics:arenaMetrics};
}

function rotateArrayDeterministic(arr,shift){
  const source=Array.isArray(arr)?arr:[];
  if(!source.length) return [];
  const n=source.length;
  const s=((num(shift,0)%n)+n)%n;
  if(s===0) return source.slice();
  return source.slice(s).concat(source.slice(0,s));
}

function reduceNeighborRepeatsDeterministic(seq,poolIds,bossGroupId){
  const out=(Array.isArray(seq)?seq:[]).slice();
  const pool=uniq((Array.isArray(poolIds)?poolIds:[]).filter(gid=>gid>0&&gid!==bossGroupId)).sort((a,b)=>a-b);
  if(out.length<2||!pool.length) return out;
  for(let i=1;i<out.length;i++){
    if(out[i]!==out[i-1]) continue;
    const next=i+1<out.length?out[i+1]:0;
    let replacement=0;
    for(const gid of pool){
      if(gid===out[i-1]) continue;
      if(next>0&&gid===next) continue;
      replacement=gid;
      break;
    }
    if(replacement>0) out[i]=replacement;
  }
  return out;
}

function deterministicStageRemix(groupIds,progress,shuffleStrength,trimRatio,rowIndex){
  const ids=parseIds(groupIds).filter(gid=>gid>0);
  if(!ids.length) return [];
  const asc=ids.slice().sort((a,b)=>{
    const pa=groupAvgPayoutById(a);
    const pb=groupAvgPayoutById(b);
    if(pa!==pb) return pa-pb;
    return a-b;
  });
  const p=clamp(Number(progress)||0,0,1);
  let staged=asc;
  if(p>=0.72) staged=asc.slice().reverse();
  else if(p>=0.38) staged=interleaveLowHigh(asc);

  const s=clamp(num(shuffleStrength,55),0,100);
  const shift=staged.length<=1?0:Math.floor(((rowIndex+1)*(s+7))/17)%staged.length;
  let remixed=rotateArrayDeterministic(staged,shift);

  const ratio=clamp(num(trimRatio,25),0,70)/100;
  const target=Math.max(2,Math.round(remixed.length*(1-ratio)));
  if(remixed.length>target){
    const keep=[];
    const step=(remixed.length-1)/Math.max(1,target-1);
    for(let i=0;i<target;i++){
      keep.push(remixed[Math.round(i*step)]);
    }
    remixed=keep;
  }
  return uniq(remixed);
}

function buildDensityPoolIds(groups){
  return (Array.isArray(groups)?groups:[])
    .slice()
    .sort((a,b)=>{
      const fa=Math.max(1,groupFishCount(a));
      const fb=Math.max(1,groupFishCount(b));
      if(fa!==fb) return fb-fa;
      const pa=num(a?.avgPayout,0);
      const pb=num(b?.avgPayout,0);
      if(pa!==pb) return pa-pb;
      return num(a?.id,0)-num(b?.id,0);
    })
    .map(g=>num(g?.id,0))
    .filter(id=>id>0);
}

function constrainSequenceByFishRangeDeterministic(seq,gapMs,minFish,maxFish,bossGroupId,poolIds,mustKeepSet){
  let out=parseIds(seq).filter(gid=>gid>0);
  const keep=mustKeepSet instanceof Set?mustKeepSet:new Set();
  const minTarget=Math.max(1,num(minFish,12));
  const maxTarget=Math.max(minTarget+1,num(maxFish,45));
  const candidates=uniq((Array.isArray(poolIds)?poolIds:[]).filter(gid=>gid>0&&gid!==bossGroupId));

  if(!out.length&&candidates.length) out=[candidates[0]];
  out=constrainSequenceByFishCap(out,gapMs,maxTarget,bossGroupId,keep);

  let cursor=0;
  for(let guard=0;guard<120;guard++){
    const peak=calcMaxConcurrentFish(out,gapMs);
    if(peak>=minTarget) break;
    if(!candidates.length) break;
    const gid=candidates[cursor%candidates.length];
    cursor+=1;
    let insertPos=Math.floor(out.length/2);
    const bossPos=out.indexOf(bossGroupId);
    if(bossPos>0) insertPos=bossPos;
    if(insertPos>0&&out[insertPos-1]===gid) insertPos=Math.min(out.length,insertPos+1);
    out.splice(insertPos,0,gid);
    out=constrainSequenceByFishCap(out,gapMs,maxTarget,bossGroupId,keep);
  }
  return out;
}

function enforceBossPlacementDeterministic(rows,bossGroupId,escortIds,minRatio,maxRatio){
  const out=(Array.isArray(rows)?rows:[]).map(row=>({
    scriptId:num(row.scriptId,0),
    gapTimeMs:Math.max(0,num(row.gapTimeMs,0)),
    arenaIds:parseIds(row.arenaIds),
    type:num(row.type,1),
    groupIds:parseIds(row.groupIds)
  }));
  if(!out.length||bossGroupId<=0) return out;

  for(const row of out){
    row.groupIds=row.groupIds.filter(gid=>gid!==bossGroupId);
  }
  const last=out[out.length-1];
  const escorts=uniq((Array.isArray(escortIds)?escortIds:[]).filter(gid=>gid>0&&gid!==bossGroupId));
  if(!last.groupIds.length&&escorts.length) last.groupIds.push(escorts[0]);
  while(last.groupIds.length<4&&escorts.length){
    last.groupIds.push(escorts[last.groupIds.length%escorts.length]);
  }
  if(!last.groupIds.length){
    last.groupIds=[bossGroupId];
  }else{
    const predictedLen=last.groupIds.length+1;
    let minIdx=Math.max(1,Math.ceil(predictedLen*minRatio)-1);
    let maxIdx=Math.min(last.groupIds.length-1,Math.floor(predictedLen*maxRatio)-1);
    if(maxIdx<minIdx) maxIdx=minIdx;
    const targetIdx=clamp(Math.floor((minIdx+maxIdx)/2),1,Math.max(1,last.groupIds.length-1));
    last.groupIds.splice(targetIdx,0,bossGroupId);
  }

  let bossIdx=last.groupIds.indexOf(bossGroupId);
  if(bossIdx<=0){
    const before=escorts[0]||last.groupIds.find(gid=>gid!==bossGroupId)||0;
    if(before>0){
      last.groupIds.unshift(before);
      bossIdx+=1;
    }
  }
  if(bossIdx>=last.groupIds.length-1){
    const after=escorts[1]||escorts[0]||last.groupIds.find(gid=>gid!==bossGroupId)||0;
    if(after>0) last.groupIds.push(after);
  }
  bossIdx=last.groupIds.indexOf(bossGroupId);
  if(escorts.length&&bossIdx>0&&groupAvgPayoutById(last.groupIds[bossIdx-1])>=20){
    last.groupIds[bossIdx-1]=escorts[0];
  }
  if(escorts.length&&bossIdx>=0&&bossIdx<last.groupIds.length-1&&groupAvgPayoutById(last.groupIds[bossIdx+1])>=20){
    last.groupIds[bossIdx+1]=escorts[1]||escorts[0];
  }

  bossIdx=last.groupIds.indexOf(bossGroupId);
  const minFinal=Math.max(1,Math.ceil(last.groupIds.length*minRatio)-1);
  const maxFinal=Math.min(last.groupIds.length-2,Math.floor(last.groupIds.length*maxRatio)-1);
  const targetFinal=clamp(bossIdx,minFinal,Math.max(minFinal,maxFinal));
  if(targetFinal!==bossIdx){
    last.groupIds.splice(bossIdx,1);
    last.groupIds.splice(targetFinal,0,bossGroupId);
  }

  for(const row of out){
    row.type=row.groupIds.includes(bossGroupId)?2:1;
  }
  return out;
}

function generateScriptsByTemplate(minPerArena,templateOptions){
  if(!state.arenas.length) return {scripts:[],issues:["无可用渔场"],score:0,seed:0,metrics:[]};
  const shuffleStrength=Math.round(clampNum(templateOptions?.templateShuffle,0,100,55));
  const trimRatio=Math.round(clampNum(templateOptions?.templateTrim,0,70,25));
  const candidateRounds=Math.max(1,Math.round(clampNum(templateOptions?.templateCandidates,1,20,8)));
  const minFish=Math.round(clampNum(templateOptions?.minConcurrentFish,5,60,12));
  const maxFish=Math.max(minFish+2,Math.round(clampNum(templateOptions?.maxConcurrentFish,10,120,45)));
  const bossMinRatio=0.55;
  const bossMaxRatio=0.78;

  let nextId=state.scripts.reduce((m,r)=>Math.max(m,r.scriptId),0)+1;
  const scripts=[];
  const issues=[];
  const arenaMetrics=[];
  const arenaScores=[];

  for(const arena of state.arenas){
    const baseRows=collectBaseRowsForArena(arena.id);
    if(!baseRows.length){
      issues.push(`Arena ${arena.id} 缺少基础脚本，已跳过`);
      continue;
    }
    const configured=collectConfiguredGroupsForArena(arena.id);
    const bossPool=configured.filter(g=>groupHasBoss(g));
    const normalPool=configured.filter(g=>!groupHasBoss(g));
    if(!bossPool.length){
      issues.push(`Arena ${arena.id} 缺少Boss组，已跳过`);
      continue;
    }
    if(!normalPool.length){
      issues.push(`Arena ${arena.id} 缺少普通组，已跳过`);
      continue;
    }

    const bossGroupId=pickBossFromArenaRows(baseRows,configured);
    if(bossGroupId<=0){
      issues.push(`Arena ${arena.id} 无法识别Boss组，已跳过`);
      continue;
    }
    const lowPool=normalPool
      .filter(g=>num(g?.avgPayout,0)<20)
      .slice()
      .sort((a,b)=>{
        const pa=num(a?.avgPayout,0);
        const pb=num(b?.avgPayout,0);
        if(pa!==pb) return pa-pb;
        return num(a?.id,0)-num(b?.id,0);
      });
    const escortIds=(lowPool.length?lowPool:normalPool)
      .map(g=>num(g?.id,0))
      .filter(id=>id>0&&id!==bossGroupId);
    const densityIds=buildDensityPoolIds(lowPool.length?lowPool:normalPool).filter(id=>id!==bossGroupId);
    const fallbackIds=(densityIds.length?densityIds:escortIds);
    if(!fallbackIds.length){
      issues.push(`Arena ${arena.id} 缺少可用于陪衬的普通组，已跳过`);
      continue;
    }

    const rowCount=Math.max(1,Math.max(minPerArena,baseRows.length));
    let bestArenaRows=[];
    let bestArenaEval={score:-999,metrics:{}};
    let bestArenaBossWindowOk=false;
    let bestArenaBossEscortOk=false;
    let bestArenaPeakMin=0;
    let bestArenaPeakMax=0;

    for(let round=0;round<candidateRounds;round++){
      const trialRows=[];
      for(let i=0;i<rowCount;i++){
        const base=baseRows[i%baseRows.length];
        const progress=rowCount<=1?1:i/(rowCount-1);
        let groupIds=deterministicStageRemix(base.groupIds,progress,shuffleStrength,trimRatio,i+round).filter(gid=>gid!==bossGroupId);
        if(!groupIds.length) groupIds=[fallbackIds[0]];
        groupIds=reduceNeighborRepeatsDeterministic(groupIds,fallbackIds,bossGroupId);
        const stageGap=buildGapMs(i,rowCount);
        const baseGap=Math.max(0,num(base.gapTimeMs,0));
        const gapMs=Math.round(clamp((baseGap*0.45)+(stageGap*0.55),700,4800)/50)*50;
        groupIds=constrainSequenceByFishRangeDeterministic(groupIds,gapMs,minFish,maxFish,bossGroupId,fallbackIds,new Set());
        if(!groupIds.length) groupIds=[fallbackIds[0]];
        trialRows.push({
          scriptId:0,
          gapTimeMs:gapMs,
          arenaIds:[arena.id],
          type:1,
          groupIds
        });
      }

      let arranged=enforceBossPlacementDeterministic(trialRows,bossGroupId,escortIds,bossMinRatio,bossMaxRatio);
      const trialLast=arranged[arranged.length-1];
      const trialBossPos=trialLast.groupIds.indexOf(bossGroupId);
      const trialKeep=new Set([bossGroupId,trialLast.groupIds[trialBossPos-1],trialLast.groupIds[trialBossPos+1]].filter(x=>num(x,0)>0));
      trialLast.groupIds=constrainSequenceByFishRangeDeterministic(trialLast.groupIds,trialLast.gapTimeMs,minFish,maxFish,bossGroupId,fallbackIds,trialKeep);
      arranged=enforceBossPlacementDeterministic(arranged,bossGroupId,escortIds,bossMinRatio,bossMaxRatio);

      const lastIds=parseIds(arranged[arranged.length-1]?.groupIds||[]);
      const finalBossPos=lastIds.indexOf(bossGroupId);
      const minBossIdx=Math.max(1,Math.ceil(lastIds.length*bossMinRatio)-1);
      const maxBossIdx=Math.max(minBossIdx,Math.min(lastIds.length-2,Math.floor(lastIds.length*bossMaxRatio)-1));
      const bossWindowOk=finalBossPos>=minBossIdx&&finalBossPos<=maxBossIdx;
      const bossEscortOk=finalBossPos>0&&finalBossPos<lastIds.length-1&&groupAvgPayoutById(lastIds[finalBossPos-1])<20&&groupAvgPayoutById(lastIds[finalBossPos+1])<20;
      const peaks=arranged.map(row=>calcMaxConcurrentFish(row.groupIds,row.gapTimeMs));
      const peakMin=peaks.length?Math.min(...peaks):0;
      const peakMax=peaks.length?Math.max(...peaks):0;
      const evalResult=evaluateTemplateArenaRows(arranged,bossGroupId);
      const penalty=
        (bossWindowOk?0:25)+
        (bossEscortOk?0:15)+
        ((peakMin<minFish||peakMax>maxFish)?18:0);
      const roundScore=evalResult.score-penalty;
      if(round===0||roundScore>bestArenaEval.score){
        bestArenaRows=arranged;
        bestArenaEval={score:roundScore,metrics:evalResult.metrics};
        bestArenaBossWindowOk=bossWindowOk;
        bestArenaBossEscortOk=bossEscortOk;
        bestArenaPeakMin=peakMin;
        bestArenaPeakMax=peakMax;
      }
    }

    const arenaRows=bestArenaRows.map(row=>({
      ...row,
      scriptId:nextId++
    }));
    const lastIds=parseIds(arenaRows[arenaRows.length-1]?.groupIds||[]);
    const finalBossPos=lastIds.indexOf(bossGroupId);
    arenaScores.push(Math.max(0,bestArenaEval.score));
    arenaMetrics.push({
      arenaId:arena.id,
      bossPos:finalBossPos+1,
      lastLen:lastIds.length,
      bossWindowOk:bestArenaBossWindowOk,
      bossEscortOk:bestArenaBossEscortOk,
      peakMin:bestArenaPeakMin,
      peakMax:bestArenaPeakMax,
      ...bestArenaEval.metrics
    });
    if(!bestArenaBossWindowOk){
      issues.push(`Arena ${arena.id} Boss位置未落在后段窗口（${bossMinRatio}-${bossMaxRatio}）`);
    }
    if(!bestArenaBossEscortOk){
      issues.push(`Arena ${arena.id} Boss缺少低倍率陪衬（前后小鱼）`);
    }
    if(bestArenaPeakMin<minFish||bestArenaPeakMax>maxFish){
      issues.push(`Arena ${arena.id} 同屏鱼数超出范围（min=${bestArenaPeakMin}, max=${bestArenaPeakMax}, target=${minFish}-${maxFish}）`);
    }
    scripts.push(...arenaRows);
  }

  const score=arenaScores.length?Math.round(arenaScores.reduce((a,b)=>a+b,0)/arenaScores.length):0;
  const metricLine=arenaMetrics
    .map(x=>`A${x.arenaId}:Boss@${x.bossPos}/${x.lastLen},Peak${x.peakMin}-${x.peakMax}`)
    .join(" | ");
  const outIssues=issues.slice(0,10);
  outIssues.push(`templateScore=${score}`);
  if(metricLine) outIssues.push(`metrics=${metricLine}`);
  return {scripts,issues:outIssues,score,seed:0,metrics:arenaMetrics};
}

function generateScriptsForAllArenas(minPerArena,seedValue){
  if(!state.arenas.length) return {scripts:[],issues:["无可用渔场"]};

  const seed=(Number(seedValue)||Date.now())>>>0;
  const rng=createSeededRng(seed);
  const bossMap=buildBossGroupMapByArena();

  let nextId=state.scripts.reduce((m,r)=>Math.max(m,r.scriptId),0)+1;
  const out=[];
  const issues=[`seed=${seed}`];

  for(const arena of state.arenas){
    const configured=collectConfiguredGroupsForArena(arena.id);
    const bossPool=configured.filter(g=>groupHasBoss(g));
    const normalPool=configured.filter(g=>!groupHasBoss(g));
    const high20Pool=normalPool.filter(g=>num(g.avgPayout,0)>=20);
    const lowPool=normalPool.filter(g=>num(g.avgPayout,0)<20);
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
    if(!high20Pool.length){
      issues.push(`Arena ${arena.id} 缺少20倍以上高倍率组，无法满足“持续高倍率”要求`);
      continue;
    }
    if(!lowPool.length){
      issues.push(`Arena ${arena.id} 缺少低倍率组，无法满足“低+高组合”要求`);
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
      const low=pickBalancedFromPoolWithRng(payoutBands.low,pattern.low,used,usageMap,cursorMap,`a${arena.id}-low`,rng);
      const middlePool=payoutBands.mid.length?payoutBands.mid:payoutBands.low;
      const mid=pickBalancedFromPoolWithRng(middlePool,pattern.mid,used,usageMap,cursorMap,`a${arena.id}-mid`,rng);
      const highPool=payoutBands.high.length?payoutBands.high:middlePool;
      const high=pickBalancedFromPoolWithRng(highPool,pattern.high,used,usageMap,cursorMap,`a${arena.id}-high`,rng);
      const finalStage=high.map(x=>x.id);

      // Mid/Late phase insert one skill group as a pattern breaker.
      if(i>=Math.floor(scriptCount*0.35)&&i<scriptCount-1&&skillPool.length){
        const skill=pickSingleWithRng(skillPool,used,usageMap,cursorMap,`a${arena.id}-skill`,[prevTail,prevHead],rng);
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
        const relief=pickSingleWithRng(payoutBands.low,used,usageMap,cursorMap,`a${arena.id}-relief`,[prevTail,prevHead],rng);
        if(relief){
          const reliefPos=Math.max(2,seq.length-2);
          seq.splice(reliefPos,0,relief.id);
        }
      }

      // Avoid repeated head/tail and long high-payout streaks.
      if(seq.length&&seq[0]===prevHead){
        const alt=pickSingleWithRng(payoutBands.low,used,usageMap,cursorMap,`a${arena.id}-alt-head`,[seq[0],prevTail],rng);
        if(alt) seq[0]=alt.id;
      }
      if(seq.length>2&&seq[seq.length-1]===prevTail&&i<scriptCount-1){
        const altTail=pickSingleWithRng(middlePool,used,usageMap,cursorMap,`a${arena.id}-alt-tail`,[seq[seq.length-1],bossGroupId],rng);
        if(altTail) seq[seq.length-1]=altTail.id;
      }
      let highStreak=0;
      for(let k=0;k<seq.length;k++){
        const gid=seq[k];
        if(highIds.has(gid)&&gid!==bossGroupId) highStreak+=1; else highStreak=0;
        if(highStreak>=3&&k<seq.length-1){
          const relief=pickSingleWithRng(payoutBands.low,used,usageMap,cursorMap,`a${arena.id}-streak-break`,[gid,bossGroupId],rng);
          if(relief) seq.splice(k,0,relief.id);
          highStreak=0;
        }
      }

      const mixed=ensureLowHighCombo(seq,lowPool,high20Pool,normalPool,usageMap,cursorMap,`a${arena.id}-s${i}`,rng,bossGroupId);
      seq=mixed.seq;
      if(i===scriptCount-1){
        seq=ensureBossNotTail(seq,bossGroupId,normalPool,usageMap,cursorMap,`a${arena.id}-boss`,rng);
      }

      const gapMs=buildGapMs(i,scriptCount);
      const beforeCapCount=seq.length;
      const beforeCapPeak=calcMaxConcurrentFish(seq,gapMs);
      const mustKeep=new Set([bossGroupId,mixed.keepHighId,mixed.keepLowId].filter(x=>num(x,0)>0));
      seq=constrainSequenceByFishCap(seq,gapMs,50,bossGroupId,mustKeep);
      if(i===scriptCount-1){
        seq=ensureBossNotTail(seq,bossGroupId,normalPool,usageMap,cursorMap,`a${arena.id}-boss-post-cap`,rng);
      }
      const afterCapPeak=calcMaxConcurrentFish(seq,gapMs);
      if(seq.length<beforeCapCount||afterCapPeak<beforeCapPeak){
        issues.push(`Arena ${arena.id} Script阶段${i+1}: 并发鱼数限制50（${beforeCapPeak}->${afterCapPeak}）`);
      }

      if(!seq.length) continue;
      prevHead=seq[0];
      prevTail=seq[seq.length-1];
      out.push({
        scriptId:nextId++,
        gapTimeMs:gapMs,
        arenaIds:[arena.id],
        type:seq.includes(bossGroupId)?2:1,
        groupIds:seq
      });
    }
  }
  return {scripts:out,issues};
}

async function tryGenerateByModel(minPerArena,llmConfig,hooks={}){
  const onStage=(msg,isWarn=false)=>{if(typeof hooks.onStage==="function") hooks.onStage(msg,isWarn);};
  const onResponse=(payload,status)=>{if(typeof hooks.onResponse==="function") hooks.onResponse(payload,status);};
  const onDebug=(item)=>{if(typeof hooks.onDebug==="function") hooks.onDebug(item);};
  const safePayload=buildSafeRequestPayload(minPerArena,llmConfig);
  onStage("准备向AI发送请求");
  try{
    console.log("[AI-REQ-JSON] /api/generate-script-ai-stream\n"+JSON.stringify(safePayload,null,2));
  }catch(_e){
    console.log("[AI-REQ] /api/generate-script-ai-stream payload =",safePayload);
  }

  const parseSSEChunk=(chunk,handler)=>{
    const normalized=String(chunk||"").replace(/\r/g,"");
    const blocks=normalized.split("\n\n");
    const remain=blocks.pop()||"";
    for(const block of blocks){
      const lines=block.split("\n");
      let eventName="message";
      const dataLines=[];
      for(const line of lines){
        if(line.startsWith("event:")) eventName=line.slice(6).trim();
        else if(line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      const rawData=dataLines.join("\n");
      if(!rawData) continue;
      let dataObj;
      try{dataObj=JSON.parse(rawData);}catch(_e){dataObj={raw:rawData};}
      handler(eventName,dataObj);
    }
    return remain;
  };

  try{
    onStage("第一步：快速探活AI接口...");
    const pingRes=await fetch("/api/ai-ping",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({llmConfig})
    });
    let pingData;
    try{pingData=await pingRes.json();}catch(_e){pingData={ok:false,error:`HTTP ${pingRes.status} 非JSON响应`};}
    if(Array.isArray(pingData.debug)){
      for(const item of pingData.debug){
        if(!item||typeof item!=="object") continue;
        onDebug(item);
      }
    }
    if(!pingData.ok) throw new Error(pingData.error||`HTTP ${pingRes.status}`);
    const elapsed=Number(pingData?.ping?.elapsedMs)||0;
    onStage(`AI接口可达（ping ${elapsed}ms）`);
  }catch(err){
    onStage(`AI接口探活失败：${err.message||err}`,true);
    return {ok:false,error:err.message||"AI接口探活失败"};
  }

  try{
    onStage("请求已发送，等待流式状态...");
    const res=await fetch("/api/generate-script-ai-stream",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({minPerArena,llmConfig})
    });
    if(!res.ok){
      throw new Error(`HTTP ${res.status}`);
    }
    if(!res.body){
      throw new Error("浏览器不支持流式读取响应体");
    }

    const reader=res.body.getReader();
    const decoder=new TextDecoder("utf-8");
    let buffer="";
    let finalData=null;
    while(true){
      const {done,value}=await reader.read();
      if(done) break;
      buffer+=decoder.decode(value,{stream:true});
      buffer=parseSSEChunk(buffer,(eventName,data)=>{
        if(eventName==="stage"){
          onStage(data.message||"处理中...",Boolean(data.warn));
          return;
        }
        if(eventName==="debug-item"){
          if(data&&typeof data==="object") onDebug(data);
          return;
        }
        if(eventName==="debug"){
          const items=Array.isArray(data.items)?data.items:[];
          for(const item of items){
            if(!item||typeof item!=="object") continue;
            onDebug(item);
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
          return;
        }
        if(eventName==="result"){
          finalData=data;
          onResponse(data,res.status);
          return;
        }
        if(eventName==="error"){
          throw new Error(data.error||"AI流式请求失败");
        }
      });
    }

    const data=finalData||{ok:false,error:"流式通道结束但未返回结果"};
    if(!data.ok) throw new Error(data.error||`HTTP ${res.status}`);
    const scripts=Array.isArray(data.scripts)?data.scripts:[];
    if(!scripts.length) throw new Error("大模型返回空结果");
    onStage(`AI返回成功：${scripts.length}行`);
    return {ok:true,scripts,model:data.model||"",notes:data.notes||"",raw:data,debug:Array.isArray(data.debug)?data.debug:[]};
  }catch(err){
    onStage(`流式请求失败，尝试普通模式：${err.message||err}`,true);
    console.error("[AI-ERR] /api/generate-script-ai-stream",err);
  }

  try{
    onStage("切换为普通请求模式...");
    const res=await fetch("/api/generate-script-ai",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({minPerArena,llmConfig})
    });
    let data;
    try{data=await res.json();}catch(_e){data={ok:false,error:`HTTP ${res.status} 非JSON响应`};}
    onResponse(data,res.status);
    if(Array.isArray(data.debug)){
      for(const item of data.debug){
        if(!item||typeof item!=="object") continue;
        onDebug(item);
      }
    }
    if(!data.ok) throw new Error(data.error||`HTTP ${res.status}`);
    const scripts=Array.isArray(data.scripts)?data.scripts:[];
    if(!scripts.length) throw new Error("大模型返回空结果");
    onStage(`AI返回成功：${scripts.length}行`);
    return {ok:true,scripts,model:data.model||"",notes:data.notes||"",raw:data,debug:Array.isArray(data.debug)?data.debug:[]};
  }catch(err){
    onStage(`AI请求失败：${err.message||err}`,true);
    console.error("[AI-ERR] /api/generate-script-ai",err);
    return {ok:false,error:err.message||"大模型生成失败"};
  }
}

async function onAutoGenerateScripts(triggerSource="topbar"){
  const llmCfg=getLLMRequestConfig();
  const minPerArena=Math.max(3,Math.round(llmCfg.minPerArena||6));
  const mode=llmCfg.mode||"auto";
  saveLLMConfig(false);
  if(!state.arenas.length||!state.groups.length){
    toast("数据未加载完成，请先点“重新读取表”",true);
    return;
  }
  const requestPayload=buildSafeRequestPayload(minPerArena,llmCfg,`req-${Date.now()}`);
  state.aiReview.minPerArena=minPerArena;
  openAIReviewDialog();
  resetAIReviewDialog(requestPayload);
  setAIReviewBusy(true);
  pushAIStatus(`启动智能生成（source=${triggerSource}, mode=${mode}, minPerArena=${minPerArena}）`);
  setReviewRawResponse({ok:false,status:"running",requestId:requestPayload.requestId,message:"生成中，请等待流式状态..."});

  let generatedResult={scripts:[],issues:[]};
  let sourceTag="constraint-rule";
  let fallbackReason="";
  let aiAttemptMeta=null;
  let templateMeta=null;
  const buildConstraintCfg=()=>({
    templateShuffle:Math.round(clampNum(llmCfg.templateShuffle,0,100,55)),
    templateTrim:Math.round(clampNum(llmCfg.templateTrim,0,70,25)),
    templateCandidates:Math.round(clampNum(llmCfg.templateCandidates,1,20,8)),
    minConcurrentFish:Math.round(clampNum(llmCfg.minConcurrentFish,5,60,12)),
    maxConcurrentFish:Math.round(clampNum(llmCfg.maxConcurrentFish,10,120,45))
  });
  const runLocal=(reasonText)=>{
    if(reasonText) pushAIStatus(reasonText,false);
    fallbackReason=String(reasonText||"");
    const cfg=buildConstraintCfg();
    generatedResult=generateScriptsByTemplate(minPerArena,cfg);
    sourceTag="constraint-rule";
    templateMeta={...cfg,deterministic:true,selectedScore:generatedResult.score||0,metrics:generatedResult.metrics||[]};
    pushAIStatus(`约束算法生成完成：${(generatedResult.scripts||[]).length}行（score=${generatedResult.score||0}）`);
  };
  const runTemplate=(reasonText)=>{
    if(reasonText) pushAIStatus(reasonText,false);
    const templateCfg=buildConstraintCfg();
    generatedResult=generateScriptsByTemplate(minPerArena,templateCfg);
    sourceTag="template-rule";
    templateMeta={
      ...templateCfg,
      deterministic:true,
      selectedScore:generatedResult.score||0,
      metrics:generatedResult.metrics||[]
    };
    pushAIStatus(`模板生成完成：${(generatedResult.scripts||[]).length}行（score=${generatedResult.score||0}）`);
  };

  if(mode==="template"){
    runTemplate("当前为模板重排模式：仅基于基础脚本打乱顺序和削减数量，不新增Group。");
    aiAttemptMeta={ok:false,reason:"mode=template"};
  }else if(mode==="local"){
    runLocal("当前为仅本地模式，未调用AI。");
    aiAttemptMeta={ok:false,reason:"mode=local"};
  }else{
    const aiResult=await tryGenerateByModel(minPerArena,llmCfg,{
      onStage:(msg,isWarn)=>pushAIStatus(msg,isWarn),
      onResponse:(payload,status)=>{
        pushAIStatus(`服务端响应：HTTP ${status}`);
        setReviewRawResponse(payload);
      },
      onDebug:(item)=>{
        if(!item||typeof item!=="object") return;
        state.aiReview.debugItems.push(item);
        refreshAIRequestPreview();
        const title=String(item.title||"untitled");
        if(title.includes("exception")||title.includes("error")||title.includes("timeout")) pushAIStatus(`debug: ${title}`,true);
      }
    });
    aiAttemptMeta=aiResult;
    if(aiResult.ok){
      generatedResult={scripts:(aiResult.scripts||[]),issues:[]};
      sourceTag=`llm:${aiResult.model||"unknown"}`;
      if(aiResult.notes) pushAIStatus(`AI说明：${aiResult.notes}`);
    }else if(mode==="auto"){
      runLocal(`AI不可用，回退约束算法：${aiResult.error}`);
    }else{
      setAIStatusBadge("AI失败",true);
      setAIValidateMessage(`AI生成失败：${aiResult.error}`,true);
      setAIReviewBusy(false);
      toast(`仅大模型模式失败：${aiResult.error}`,true);
      return;
    }
  }

  const generated=generatedResult.scripts||[];
  if(!generated.length){
    const reason=(generatedResult.issues||[]).slice(0,2).join("；");
    setAIStatusBadge("生成失败",true);
    setAIValidateMessage(`自动生成失败：${reason||"当前配置不足"}`,true);
    setAIReviewBusy(false);
    toast(`自动生成失败：${reason||"当前配置不足"}`,true);
    return;
  }

  if((generatedResult.issues||[]).length){
    const warnIssue=(generatedResult.issues||[]).find(x=>String(x).includes("跳过"));
    if(warnIssue) pushAIStatus(`部分渔场被跳过：${warnIssue}`,true);
    const scoreIssue=(generatedResult.issues||[]).find(x=>String(x).startsWith("templateScore="));
    if(scoreIssue) pushAIStatus(`模板选优结果：${scoreIssue}`);
  }
  if(!state.aiReview.lastResponse){
    const explain=sourceTag==="constraint-rule"
      ?"当前结果来自约束算法（确定性，Boss与同屏鱼数有硬约束）"
      :sourceTag==="template-rule"
        ?"当前结果来自模板重排约束算法（只打乱/缩减，不新增Group）"
        :"当前结果来自AI";
    setReviewRawResponse({
      ok:true,
      source:sourceTag,
      rows:generated.length,
      issues:generatedResult.issues||[],
      explain,
      mode,
      template:templateMeta,
      score:generatedResult.score,
      fallbackReason,
      aiAttempt:aiAttemptMeta
    });
  }
  state.aiReview.sourceTag=sourceTag;
  state.aiReview.candidateScripts=generated;
  setReviewEditorPayload({scripts:generated});
  const checked=validateReviewEditor(false);
  if(checked.ok){
    setAIStatusBadge("已生成，待确认使用",false);
    pushAIStatus(`JSON识别成功：${generated.length}行，请检查后点击“确认使用”。`);
  }else{
    setAIStatusBadge("待手工修正JSON",true);
    pushAIStatus(`JSON识别失败：${checked.error}`,true);
  }
  setAIReviewBusy(false);
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
