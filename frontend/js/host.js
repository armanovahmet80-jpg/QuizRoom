const quizSelect=document.getElementById("quiz"), setup=document.getElementById("setup"), room=document.getElementById("room");
const setupError=document.getElementById("setupError"), roomError=document.getElementById("roomError");
let pin=new URLSearchParams(location.search).get("pin"), timer=null;

async function loadQuizzes(){
 try{const qs=await api("/api/quizzes");quizSelect.innerHTML=qs.map(q=>`<option value="${q.id}">${escapeHtml(q.title)} — ${q.count} вопросов</option>`).join("");}
 catch(e){showError(setupError,e.message)}
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
async function setupRoom(){
 if(!pin){setup.classList.remove("hidden");room.classList.add("hidden");await loadQuizzes();return;}
 try{await api(`/api/rooms/${pin}`);showRoom();}catch(e){pin=null;history.replaceState(null,"","/host.html");showError(setupError,e.message);await loadQuizzes();}
}
function showRoom(){
 setup.classList.add("hidden");room.classList.remove("hidden");
 document.getElementById("pin").textContent=pin;
 const joinUrl=location.origin+"/join.html?pin="+pin;
 document.getElementById("link").textContent=joinUrl;
 const qr=document.getElementById("qr");qr.innerHTML="";
 if(location.hostname==="127.0.0.1"||location.hostname==="localhost"){qr.innerHTML="<p class='error'>Откройте панель по IP ноутбука, чтобы QR работал на телефонах.</p>";}
 else if(window.QRCode)new QRCode(qr,{text:joinUrl,width:256,height:256});
 refresh();clearInterval(timer);timer=setInterval(refresh,2000);
}
document.getElementById("createRoom").addEventListener("click",async()=>{
 try{const data=await api("/api/rooms",{method:"POST",body:JSON.stringify({quiz_id:Number(quizSelect.value)})});location.href="/host.html?pin="+data.pin;}
 catch(e){showError(setupError,e.message)}
});
document.getElementById("start").addEventListener("click",async()=>{
 try{await api(`/api/rooms/${pin}/start`,{method:"POST"});refresh()}catch(e){showError(roomError,e.message)}
});
document.getElementById("finish").addEventListener("click",async()=>{
 try{await api(`/api/rooms/${pin}/finish`,{method:"POST"});refresh()}catch(e){showError(roomError,e.message)}
});
async function refresh(){
 try{
  const state=await api(`/api/rooms/${pin}`);
  document.getElementById("playerCount").textContent=`(${state.players.length})`;
  document.getElementById("players").innerHTML=state.players.map(n=>`<span class="player-chip">${escapeHtml(n)}</span>`).join("")||"<span class='subtitle'>Пока никто не подключился</span>";
  document.getElementById("start").disabled=state.status!=="waiting"||state.players.length===0;
  document.getElementById("finish").disabled=state.status!=="playing";
  const board=await api(`/api/rooms/${pin}/leaderboard`);
  document.getElementById("leaderboard").innerHTML=board.map((p,i)=>`<tr><td class="rank">${i+1}</td><td>${escapeHtml(p.name)}</td><td><b>${p.score}</b></td><td>${p.answered} / ${p.total}</td></tr>`).join("");
  if(state.status==="finished")renderPodium(board);
 }catch(e){showError(roomError,e.message)}
}
function renderPodium(board){
 const card=document.getElementById("podiumCard"), podium=document.getElementById("podium");card.classList.remove("hidden");
 const top=board.slice(0,3), order=[top[1],top[0],top[2]].filter(Boolean);
 podium.innerHTML=order.map((p,i)=>`<div class="podium-item"><b>${escapeHtml(p.name)}</b><div class="podium-place">${i===1?"🥇":i===0?"🥈":"🥉"}<br>${p.score}</div></div>`).join("");
}
setupRoom();
