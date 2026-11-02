const pin=localStorage.getItem("quizroom_pin"), playerId=localStorage.getItem("quizroom_player_id");
const appEl=document.getElementById("app"), errorEl=document.getElementById("error"), scoreEl=document.getElementById("score");
let questions=null, current=0, answeredCount=0, loading=false;

if(!pin||!playerId){location.href="/";}

function renderWaiting(state){
  appEl.innerHTML=`<div class="waiting"><span class="badge">${state.name}</span><h2>Вы в игре 🎉</h2><p class="subtitle">Ждём старта ведущего…</p><p>Игроков в комнате: <b>${state.total}</b></p></div>`;
}
function renderQuestion(){
  if(!questions) return;
  if(current>=questions.length){
    appEl.innerHTML=`<div class="waiting"><h2>Все вопросы пройдены!</h2><p class="subtitle">Ждём, когда ведущий завершит игру…</p></div>`;
    return;
  }
  const q=questions[current];
  appEl.innerHTML=`<div class="progress"><div style="width:${((current)/questions.length)*100}%"></div></div>
  <span class="badge">Вопрос ${current+1} из ${questions.length}</span>
  <h2>${escapeHtml(q.text)}</h2>
  <div class="answers">${q.options.map((o,i)=>`<button class="answer" data-option="${i}">${escapeHtml(o)}</button>`).join("")}</div>`;
  appEl.querySelectorAll(".answer").forEach(btn=>btn.addEventListener("click",()=>sendAnswer(Number(btn.dataset.option))));
}
function renderFinished(state){
  appEl.innerHTML=`<div class="waiting"><span class="badge">Игра завершена</span><h2>Отличная работа, ${escapeHtml(state.name)}!</h2><h1>${state.score} очков</h1><p class="subtitle">Ваше место: <b>${state.place}</b> из ${state.total}</p></div>`;
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}

async function loadQuestions(state){
  if(questions) return;
  questions=await api(`/api/rooms/${pin}/questions`);
  answeredCount=state.answered;
  current=answeredCount;
  renderQuestion();
}
async function sendAnswer(option){
  if(loading)return;
  loading=true;
  document.querySelectorAll(".answer").forEach(b=>b.disabled=true);
  try{
    const result=await api(`/api/rooms/${pin}/answer`,{method:"POST",body:JSON.stringify({player_id:playerId,question:current,option})});
    scoreEl.textContent=`${result.score} очков`;
    const feedback=document.createElement("div");
    feedback.className=`feedback ${result.correct?"ok":"bad"}`;
    feedback.textContent=result.correct?"✅ Верно! +100":"❌ Неверно";
    appEl.appendChild(feedback);
    current++;
    setTimeout(()=>{loading=false;renderQuestion()},650);
  }catch(e){loading=false;showError(errorEl,e.message);renderQuestion();}
}
async function poll(){
 try{
  const state=await api(`/api/rooms/${pin}/players/${playerId}`);
  scoreEl.textContent=`${state.score} очков`;
  showError(errorEl,"");
  if(state.status==="waiting") renderWaiting(state);
  else if(state.status==="playing") await loadQuestions(state);
  else renderFinished(state);
 }catch(e){showError(errorEl,e.message)}
}
poll();setInterval(poll,2000);
