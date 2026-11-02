const pin=new URLSearchParams(location.search).get("pin");
const form=document.getElementById("joinForm"), nameInput=document.getElementById("name"), error=document.getElementById("error");
if(!pin){showError(error,"PIN не указан");form.classList.add("hidden")}
(async()=>{try{const room=await api(`/api/rooms/${pin}`);document.getElementById("quizTitle").textContent=`${room.quiz_title} · ${room.count} вопросов`;}catch(e){showError(error,e.message);form.classList.add("hidden")}})();
form.addEventListener("submit",async e=>{e.preventDefault();showError(error,"");try{const data=await api(`/api/rooms/${pin}/join`,{method:"POST",body:JSON.stringify({name:nameInput.value})});localStorage.setItem("quizroom_pin",pin);localStorage.setItem("quizroom_player_id",data.player_id);location.href="/play.html";}catch(err){showError(error,err.message)}});
