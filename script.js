
"use strict";

/* FINANCE MANAGER MAX
   Local-first finance tracker.
   All records are stored in this browser.
*/

const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().slice(0,10);
const money = n => `${state.currency}${Number(n || 0).toLocaleString("en-IN",{maximumFractionDigits:2})}`;
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);

const blank = {
  currency:"₹",
  transactions:[],
  loans:[],
  goals:[],
  budgets:[],
  theme:"dark"
};

let state = load();
let cashChart, categoryChart;
let balanceHidden = false;

function load(){
  try {
    const saved = JSON.parse(localStorage.getItem("fm_max_data"));
    return {...blank,...(saved || {})};
  } catch(e) { return {...blank}; }
}
function save(){
  localStorage.setItem("fm_max_data",JSON.stringify(state));
}
function notify(message){
  $("toast").textContent=message;
  $("toast").classList.add("show");
  clearTimeout(notify.timer);
  notify.timer=setTimeout(()=>$("toast").classList.remove("show"),2200);
}
function escapeHTML(value){
  return String(value ?? "").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function dateText(d){
  if(!d)return "No date";
  return new Date(d+"T12:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
}
function totalIncome(){
  return state.transactions.filter(x=>x.type==="income").reduce((s,x)=>s+x.amount,0);
}
function totalExpense(){
  return state.transactions.filter(x=>x.type==="expense").reduce((s,x)=>s+x.amount,0);
}
function totalSaved(){
  return state.goals.reduce((s,x)=>s+Math.min(x.current,x.target),0);
}
function totalLoanDue(){
  return state.loans.reduce((s,x)=>s+Math.max(0,x.principal-x.paid),0);
}
function pct(a,b){
  return b>0?Math.min(100,Math.max(0,a/b*100)):0;
}

/* NAVIGATION */
function goTo(id){
  document.querySelectorAll(".screen").forEach(x=>x.classList.toggle("active",x.id===id));
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.go===id));
  window.scrollTo({top:0,behavior:"smooth"});
  if(id==="dashboard")renderDashboard();
  if(id==="analytics")renderAnalytics();
}
document.querySelectorAll("[data-go]").forEach(btn=>{
  btn.addEventListener("click",()=>goTo(btn.dataset.go));
});

/* DASHBOARD */
function renderDashboard(){
  const income=totalIncome(),expense=totalExpense();
  const bal=income-expense;
  $("balance").textContent=balanceHidden?"••••••":money(bal);
  $("incomeTotal").textContent=balanceHidden?"••••":money(income);
  $("expenseTotal").textContent=balanceHidden?"••••":money(expense);
  $("savedTotal").textContent=money(totalSaved());
  $("loanDue").textContent=money(totalLoanDue());
  $("transactionCount").textContent=state.transactions.length;

  const budgets=state.budgets;
  const used=budgets.reduce((s,b)=>s+expenseForCategory(b.category),0);
  const limits=budgets.reduce((s,b)=>s+b.amount,0);
  $("budgetUsed").textContent=limits?Math.round(pct(used,limits))+"%":"—";

  $("recentList").innerHTML=state.transactions.slice().sort((a,b)=>b.created-a.created).slice(0,5).map(transactionHTML).join("");
  drawCashChart();
}
function transactionHTML(t){
  const positive=t.type==="income";
  return `<div class="activity">
    <div class="activity-icon">${positive?"↗":"↘"}</div>
    <div class="activity-main"><b>${escapeHTML(t.name)}</b><small>${escapeHTML(t.category||"Other")} · ${dateText(t.date)}</small></div>
    <span class="amount ${positive?"positive":"negative"}">${positive?"+":"−"}${money(t.amount)}</span>
    <button class="delete-btn" data-delete-transaction="${t.id}" title="Delete">×</button>
  </div>`;
}
function drawCashChart(){
  const canvas=$("cashChart");
  if(!canvas||typeof Chart==="undefined")return;
  const labels=[],income=[],expense=[];
  const now=new Date();
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
    labels.push(d.toLocaleDateString("en-IN",{month:"short"}));
    income.push(state.transactions.filter(t=>t.type==="income"&&t.date.startsWith(key)).reduce((s,t)=>s+t.amount,0));
    expense.push(state.transactions.filter(t=>t.type==="expense"&&t.date.startsWith(key)).reduce((s,t)=>s+t.amount,0));
  }
  if(cashChart)cashChart.destroy();
  cashChart=new Chart(canvas,{type:"bar",data:{labels,datasets:[
    {label:"Income",data:income,borderRadius:5,backgroundColor:"#54e0a0"},
    {label:"Expenses",data:expense,borderRadius:5,backgroundColor:"#9c83ff"}
  ]},options:{responsive:true,plugins:{legend:{labels:{color:"#9aa9c0"}}},scales:{x:{ticks:{color:"#9aa9c0"},grid:{display:false}},y:{beginAtZero:true,ticks:{color:"#9aa9c0"},grid:{color:"#263249"}}}}});
}

/* INCOME */
$("incomeDate").value=today();
$("expenseDate").value=today();
$("receiptDate").value=today();

$("incomeForm").addEventListener("submit",e=>{
  e.preventDefault();
  const amount=Number($("incomeAmount").value);
  if(amount<=0)return;
  state.transactions.push({
    id:uid(),type:"income",name:$("incomeName").value.trim(),
    amount,date:$("incomeDate").value,category:$("incomeCategory").value,
    created:Date.now()
  });
  save();e.target.reset();$("incomeDate").value=today();
  renderAll();notify("Income added successfully");
});
function renderIncome(){
  $("incomeList").innerHTML=state.transactions.filter(t=>t.type==="income").sort((a,b)=>b.created-a.created).map(transactionHTML).join("");
}

/* EXPENSES */
$("expenseForm").addEventListener("submit",e=>{
  e.preventDefault();
  const amount=Number($("expenseAmount").value);
  if(amount<=0)return;
  state.transactions.push({
    id:uid(),type:"expense",name:$("expenseName").value.trim(),
    amount,date:$("expenseDate").value,category:$("expenseCategory").value,
    account:$("expenseAccount").value,note:$("expenseNote").value.trim(),
    created:Date.now()
  });
  save();e.target.reset();$("expenseDate").value=today();
  renderAll();notify("Expense saved");
});
function renderExpenses(){
  const query=$("searchTransactions").value.toLowerCase();
  $("expenseList").innerHTML=state.transactions.filter(t=>
    t.type==="expense" &&
    (t.name+" "+t.category+" "+(t.note||"")).toLowerCase().includes(query)
  ).sort((a,b)=>b.created-a.created).map(transactionHTML).join("");
}
$("searchTransactions").addEventListener("input",renderExpenses);

/* DELETE TRANSACTIONS */
document.addEventListener("click",e=>{
  const btn=e.target.closest("[data-delete-transaction]");
  if(!btn)return;
  if(confirm("Delete this transaction?")){
    state.transactions=state.transactions.filter(t=>t.id!==btn.dataset.deleteTransaction);
    save();renderAll();notify("Transaction deleted");
  }
});

/* RECEIPT UPLOAD */
$("receiptFile").addEventListener("change",e=>{
  const file=e.target.files[0];
  if(!file)return;
  $("fileStatus").textContent=`Selected: ${file.name}`;
  if(file.type.startsWith("image/")){
    const reader=new FileReader();
    reader.onload=ev=>{
      $("receiptPreview").src=ev.target.result;
      $("receiptPreview").style.display="block";
    };
    reader.readAsDataURL(file);
  }else{
    $("receiptPreview").style.display="none";
  }
});
$("receiptForm").addEventListener("submit",e=>{
  e.preventDefault();
  const amount=Number($("receiptAmount").value);
  if(amount<=0)return;
  state.transactions.push({
    id:uid(),type:"expense",name:$("receiptMerchant").value.trim(),
    amount,date:$("receiptDate").value,category:$("receiptCategory").value,
    account:"Card",note:"Receipt review",created:Date.now()
  });
  save();e.target.reset();$("receiptDate").value=today();
  renderAll();notify("Receipt added to expenses");
});

/* LOANS */
$("loanForm").addEventListener("submit",e=>{
  e.preventDefault();
  const principal=Number($("loanPrincipal").value);
  const emi=Number($("loanEmi").value);
  if(principal<=0||emi<=0)return;
  state.loans.push({
    id:uid(),name:$("loanName").value.trim(),principal,
    rate:Number($("loanRate").value)||0,emi,
    paid:Math.min(principal,Math.max(0,Number($("loanPaid").value)||0)),
    due:$("loanDueDate").value
  });
  save();e.target.reset();renderAll();notify("Loan created");
});
function renderLoans(){
  $("loanList").innerHTML=state.loans.map(l=>{
    const progress=pct(l.paid,l.principal);
    const remaining=Math.max(0,l.principal-l.paid);
    return `<article class="loan-card">
      <div class="card-top"><h3>${escapeHTML(l.name)}</h3><button data-delete-loan="${l.id}">Delete</button></div>
      <p class="card-meta">Principal: ${money(l.principal)} · Interest: ${l.rate}% yearly<br>EMI: ${money(l.emi)} · Next due: ${dateText(l.due)}</p>
      <div class="progress-label"><span>Repayment progress</span><b>${progress.toFixed(0)}%</b></div>
      <div class="progress"><div class="progress-bar" style="width:${progress}%"></div></div>
      <div class="progress-label"><span>Paid: ${money(l.paid)}</span><span>Remaining: ${money(remaining)}</span></div>
      <div class="card-actions"><button data-pay-loan="${l.id}">＋ Record EMI</button></div>
    </article>`;
  }).join("");
}
$("loanList").addEventListener("click",e=>{
  const del=e.target.closest("[data-delete-loan]");
  const pay=e.target.closest("[data-pay-loan]");
  if(del){
    if(confirm("Delete this loan?")){
      state.loans=state.loans.filter(l=>l.id!==del.dataset.deleteLoan);
      save();renderAll();notify("Loan deleted");
    }
  }
  if(pay){
    const l=state.loans.find(x=>x.id===pay.dataset.payLoan);
    if(!l)return;
    const amount=Number(prompt(`EMI amount for ${l.name}`,l.emi));
    if(!amount||amount<=0)return;
    l.paid=Math.min(l.principal,l.paid+amount);
    state.transactions.push({id:uid(),type:"expense",name:"EMI · "+l.name,amount,date:today(),category:"Bills",created:Date.now()});
    save();renderAll();notify("EMI recorded and progress updated");
  }
});

/* SAVINGS */
$("goalForm").addEventListener("submit",e=>{
  e.preventDefault();
  const target=Number($("goalTarget").value);
  if(target<=0)return;
  state.goals.push({
    id:uid(),name:$("goalName").value.trim(),target,
    current:Math.max(0,Number($("goalCurrent").value)||0),
    deadline:$("goalDeadline").value
  });
  save();e.target.reset();renderAll();notify("Savings goal created");
});
function renderGoals(){
  $("goalList").innerHTML=state.goals.map(g=>{
    const progress=pct(g.current,g.target);
    return `<article class="goal-card">
      <div class="card-top"><h3>◎ ${escapeHTML(g.name)}</h3><button data-delete-goal="${g.id}">Delete</button></div>
      <p class="card-meta">Target: ${money(g.target)}<br>Deadline: ${dateText(g.deadline)}</p>
      <div class="progress-label"><span>${money(g.current)} saved</span><b>${progress.toFixed(0)}%</b></div>
      <div class="progress"><div class="progress-bar" style="width:${progress}%"></div></div>
      <div class="card-actions"><button data-add-goal="${g.id}">＋ Add savings</button></div>
    </article>`;
  }).join("");
}
$("goalList").addEventListener("click",e=>{
  const del=e.target.closest("[data-delete-goal]");
  const add=e.target.closest("[data-add-goal]");
  if(del&&confirm("Delete this goal?")){
    state.goals=state.goals.filter(g=>g.id!==del.dataset.deleteGoal);
    save();renderAll();notify("Goal deleted");
  }
  if(add){
    const g=state.goals.find(x=>x.id===add.dataset.addGoal);
    const amount=Number(prompt("How much did you save?", "100"));
    if(!g||!amount||amount<=0)return;
    g.current+=amount;
    save();renderAll();notify("Savings updated");
  }
});

/* BUDGETS */
$("budgetForm").addEventListener("submit",e=>{
  e.preventDefault();
  const category=$("budgetCategory").value;
  const amount=Number($("budgetAmount").value);
  if(amount<=0)return;
  const existing=state.budgets.find(b=>b.category===category);
  if(existing)existing.amount=amount;
  else state.budgets.push({id:uid(),category,amount});
  save();e.target.reset();renderAll();notify("Budget saved");
});
function expenseForCategory(category){
  return state.transactions.filter(t=>t.type==="expense"&&t.category===category).reduce((s,t)=>s+t.amount,0);
}
function renderBudgets(){
  $("budgetList").innerHTML=state.budgets.map(b=>{
    const spent=expenseForCategory(b.category);
    const progress=pct(spent,b.amount);
    return `<article class="budget-card">
      <div class="card-top"><h3>${escapeHTML(b.category)}</h3><button data-delete-budget="${b.id}">Delete</button></div>
      <p class="card-meta">Spent ${money(spent)} of ${money(b.amount)}</p>
      <div class="progress-label"><span>Monthly budget</span><b>${progress.toFixed(0)}%</b></div>
      <div class="progress"><div class="progress-bar" style="width:${progress}%"></div></div>
      <p class="small ${spent>b.amount?"negative":"muted"}">${spent>b.amount?"Budget exceeded by "+money(spent-b.amount):"Remaining: "+money(b.amount-spent)}</p>
    </article>`;
  }).join("");
}
$("budgetList").addEventListener("click",e=>{
  const btn=e.target.closest("[data-delete-budget]");
  if(btn&&confirm("Delete this budget?")){
    state.budgets=state.budgets.filter(b=>b.id!==btn.dataset.deleteBudget);
    save();renderAll();notify("Budget deleted");
  }
});

/* ANALYTICS */
function renderAnalytics(){
  const groups={};
  state.transactions.filter(t=>t.type==="expense").forEach(t=>groups[t.category]=(groups[t.category]||0)+t.amount);
  const labels=Object.keys(groups);
  if(categoryChart)categoryChart.destroy();
  if(typeof Chart!=="undefined"&&labels.length){
    categoryChart=new Chart($("categoryChart"),{
      type:"doughnut",
      data:{labels,datasets:[{data:Object.values(groups),backgroundColor:["#56e0f2","#9c83ff","#54e0a0","#ffbf69","#ff7e91","#7295ff","#c1a0ff"]}]},
      options:{responsive:true,plugins:{legend:{position:"bottom",labels:{color:"#9aa9c0"}}}}
    });
  }
  const expenses=totalExpense(),income=totalIncome();
  const biggest=labels.sort((a,b)=>groups[b]-groups[a])[0];
  $("insights").innerHTML=`
    <div class="insight">💰 <b>Net cash flow:</b> ${money(income-expenses)}</div>
    <div class="insight">📊 <b>Largest category:</b> ${biggest?escapeHTML(biggest)+" · "+money(groups[biggest]):"No spending yet"}</div>
    <div class="insight">🎯 <b>Savings goals:</b> ${state.goals.length} active goal(s)</div>
    <div class="insight">↻ <b>Outstanding loans:</b> ${money(totalLoanDue())}</div>`;
}

/* EXPORT */
$("exportBtn").addEventListener("click",()=>{
  const rows=[["Date","Type","Name","Category","Amount","Account","Note"]];
  state.transactions.forEach(t=>rows.push([t.date,t.type,t.name,t.category,t.amount,t.account||"",t.note||""]));
  const csv=rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="finance-manager-export.csv";a.click();
  URL.revokeObjectURL(url);notify("CSV export created");
});

/* SETTINGS */
$("themeBtn").addEventListener("click",()=>{
  state.theme=state.theme==="dark"?"light":"dark";
  applyTheme();save();
});
function applyTheme(){
  document.body.classList.toggle("light",state.theme==="light");
  $("themeBtn").textContent=state.theme==="dark"?"☀":"☾";
}
$("hideBalance").addEventListener("click",()=>{
  balanceHidden=!balanceHidden;renderDashboard();
});
$("currencyBtn").addEventListener("click",()=>{
  const c=prompt("Enter currency symbol",state.currency);
  if(c&&c.length<=4){state.currency=c;save();renderAll();notify("Currency updated");}
});
$("demoBtn").addEventListener("click",()=>{
  if(!confirm("Add demo records to your existing data?"))return;
  const d=today();
  state.transactions.push(
    {id:uid(),type:"income",name:"Monthly income",amount:25000,date:d,category:"Salary",created:Date.now()},
    {id:uid(),type:"expense",name:"Groceries",amount:1800,date:d,category:"Food",created:Date.now()},
    {id:uid(),type:"expense",name:"Transport",amount:650,date:d,category:"Travel",created:Date.now()}
  );
  state.loans.push({id:uid(),name:"Education Loan",principal:100000,rate:8.5,emi:5000,paid:20000,due:d});
  state.goals.push({id:uid(),name:"Emergency Fund",target:50000,current:12500,deadline:d});
  save();renderAll();notify("Demo data added");
});
$("clearBtn").addEventListener("click",()=>{
  if(confirm("This permanently deletes all locally saved records. Continue?")){
    state={...blank,transactions:[],loans:[],goals:[],budgets:[],theme:state.theme};
    save();renderAll();notify("All local data deleted");
  }
});

/* RENDER EVERYTHING */
function renderAll(){
  renderDashboard();
  renderIncome();
  renderExpenses();
  renderLoans();
  renderGoals();
  renderBudgets();
  if($("analytics").classList.contains("active"))renderAnalytics();
}
applyTheme();
renderAll();
