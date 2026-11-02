const questionsEl=document.getElementById("questions"), errorEl=document.getElementById("error");
let counter=0;
function addQuestion(){
 counter++;
 const n=counter, div=document.createElement("div");div.className="question-editor";div.dataset.n=n;
 div.innerHTML=`<div class="topbar"><h3>Вопрос ${n}</h3><button type="button" class="btn danger remove">Удалить</button></div>
 <label>Текст вопроса</label><input class="q-text" placeholder="Введите вопрос">
 <div class="options"></div><button type="button" class="btn secondary add-option">+ Вариант</button>`;
 questionsEl.appendChild(div);
 const options=div.querySelector(".options");
 for(let i=0;i<2;i++) addOption(options,n,i);
 div.querySelector(".add-option").addEventListener("click",()=>{if(options.children.length<4)addOption(options,n,options.children.length);else showError(errorEl,"Максимум 4 варианта")});
 div.querySelector(".remove").addEventListener("click",()=>div.remove());
}
function addOption(container,n,index){
 const row=document.createElement("div");row.className="option-row";
 row.innerHTML=`<input class="option" maxlength="100" placeholder="Вариант ${index+1}"><label style="margin:0;display:flex;align-items:center;gap:6px"><input class="correct-radio" type="radio" name="correct-${n}" value="${index}"> Верный</label>`;
 container.appendChild(row);
}
document.getElementById("add").addEventListener("click",addQuestion);
document.getElementById("save").addEventListener("click",async()=>{
 showError(errorEl,"");
 const title=document.getElementById("title").value.trim(), description=document.getElementById("description").value.trim();
 const editors=[...questionsEl.querySelectorAll(".question-editor")];
 if(!title)return showError(errorEl,"Введите название квиза");
 if(!editors.length)return showError(errorEl,"Добавьте хотя бы один вопрос");
 const questions=[];
 for(const [idx,div] of editors.entries()){
  const text=div.querySelector(".q-text").value.trim(), opts=[...div.querySelectorAll(".option")].map(x=>x.value.trim());
  const radio=div.querySelector(".correct-radio:checked");
  if(!text)return showError(errorEl,`Вопрос ${idx+1}: введите текст`);
  if(opts.length<2||opts.length>4||opts.some(x=>!x))return showError(errorEl,`Вопрос ${idx+1}: заполните 2–4 варианта`);
  if(!radio)return showError(errorEl,`Вопрос ${idx+1}: выберите правильный ответ`);
  questions.push({text,options:opts,correct:Number(radio.value)});
 }
 try{await api("/api/quizzes",{method:"POST",body:JSON.stringify({title,description,questions})});alert("Квиз сохранён!");location.href="/host.html";}
 catch(e){showError(errorEl,e.message)}
});
addQuestion();
