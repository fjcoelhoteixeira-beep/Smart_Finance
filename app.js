// 1. ESTADO GLOBAL
let appData = { accounts: [], months: {} };
let currentDate = new Date();
let selectedAccountId = 'all';
const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// 2. INICIALIZAÇÃO E FIREBASE
function init() {
    db.ref('smartFinanceData').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            appData = data;
        } else {
            appData = {
                accounts: [{ id: '1', name: 'Principal', balance: 0, color: 'bg-indigo-600' }],
                months: {}
            };
            saveToStorage();
        }
        setupCurrentMonth();
        updateUI();
    });
}

function saveToStorage() {
    db.ref('smartFinanceData').set(appData);
}

// 3. LOGICA DE MESES
function getMonthKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function setupCurrentMonth() {
    const key = getMonthKey(currentDate);
    if (!appData.months[key]) {
        const prevDate = new Date(currentDate);
        prevDate.setMonth(prevDate.getMonth() - 1);
        const prevData = appData.months[getMonthKey(prevDate)];
        appData.months[key] = {
            savings: prevData ? prevData.savings : 0,
            expenses: []
        };
        saveToStorage();
    }
}

// 4. ATUALIZAÇÃO DA UI
function updateUI() {
    const key = getMonthKey(currentDate);
    const data = appData.months[key];
    if (!data) return;

    document.getElementById('currentMonthDisplay').innerText = monthNames[currentDate.getMonth()] + " " + currentDate.getFullYear();
    renderAccounts(data);
    renderReceipts(data);
    renderStats(data);
}

function renderAccounts(data) {
    const list = document.getElementById('accountsList');
    const totalGlobal = appData.accounts.reduce((acc, curr) => acc + curr.balance, 0);
    document.getElementById('globalBalanceDisplay').innerText = "Saldo Global: € " + totalGlobal.toFixed(2);

    list.innerHTML = appData.accounts.map(acc => {
        const isSelected = selectedAccountId === acc.id;
        return `
            <div onclick="setAccountFilter('${acc.id}')" 
                 class="min-w-[160px] ${acc.color} p-5 rounded-[2.5rem] shadow-lg text-white relative cursor-pointer transition-all ${isSelected ? 'ring-4 ring-white/50 scale-105' : 'opacity-40 hover:opacity-60'}">
                <button onclick="event.stopPropagation(); deleteAccount('${acc.id}')" class="absolute top-4 right-4 w-6 h-6 bg-black/10 rounded-full flex items-center justify-center">
                    <i class="bi bi-x text-xs"></i>
                </button>
                <p class="text-[9px] opacity-70 uppercase font-bold mb-1">${acc.name}</p>
                <p class="text-xl font-extrabold italic">€${acc.balance.toFixed(2)}</p>
            </div>`;
    }).join('');

    let activeBal = totalGlobal;
    if(selectedAccountId !== 'all') {
        const acc = appData.accounts.find(a => a.id === selectedAccountId);
        activeBal = acc ? acc.balance : 0;
        document.getElementById('walletLabel').innerText = "Saldo: " + (acc ? acc.name : "");
    } else {
        document.getElementById('walletLabel').innerText = "Saldo Consolidado";
    }

    document.getElementById('walletMainBalance').innerText = "€ " + activeBal.toFixed(2);
    document.getElementById('displaySavings').innerText = "€ " + (data.savings || 0).toFixed(2);
}

function renderReceipts(data) {
    const feed = document.getElementById('receiptsFeed');
    const filtered = selectedAccountId === 'all' ? data.expenses : data.expenses.filter(e => e.accountId === selectedAccountId);
    document.getElementById('filterStatus').classList.toggle('hidden', selectedAccountId === 'all');

    if (!filtered || filtered.length === 0) {
        feed.innerHTML = `<div class="text-center py-20 opacity-20 font-bold uppercase text-[10px] tracking-widest">Vazio</div>`;
        return;
    }

    feed.innerHTML = filtered.map(rec => {
        const acc = appData.accounts.find(a => a.id === rec.accountId);
        return `
            <div class="receipt-paper shadow-sm mb-6">
                <div class="p-6 border-b border-dashed border-slate-100 flex justify-between items-start">
                    <div>
                        <span class="text-[8px] font-bold uppercase tracking-widest text-indigo-500">${rec.type}</span>
                        <h3 class="font-bold text-lg text-slate-800">${rec.name}</h3>
                        <p class="text-[10px] font-bold text-slate-300 uppercase">${acc ? acc.name : 'Geral'}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xl font-black text-slate-900 italic">€${rec.value.toFixed(2)}</p>
                        <button onclick="deleteExpense('${rec.id}')" class="text-slate-200 hover:text-rose-500 mt-2"><i class="bi bi-trash3-fill"></i></button>
                    </div>
                </div>
                <div class="p-4 bg-slate-50/20">
                    ${rec.products.map(p => `<div class="flex justify-between text-[10px] uppercase font-bold text-slate-400"><span>${p.name}</span><span>€${p.price.toFixed(2)}</span></div>`).join('')}
                </div>
            </div>`;
    }).reverse().join('');
}

// 5. MODAIS (Contas, Ganhos, Gastos)
function openAccountModal() {
    document.getElementById('modalTitle').innerText = "Nova Conta";
    document.getElementById('modalContent').innerHTML = `
        <input type="text" id="accName" placeholder="Nome da Conta" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
        <input type="number" id="accBal" placeholder="Saldo Inicial €" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
        <div class="flex justify-between py-2">
            <button onclick="setCol('bg-indigo-600', this)" class="c-btn w-10 h-10 rounded-full bg-indigo-600 ring-4 ring-indigo-100"></button>
            <button onclick="setCol('bg-emerald-500', this)" class="c-btn w-10 h-10 rounded-full bg-emerald-500"></button>
            <button onclick="setCol('bg-rose-500', this)" class="c-btn w-10 h-10 rounded-full bg-rose-500"></button>
            <button onclick="setCol('bg-slate-800', this)" class="c-btn w-10 h-10 rounded-full bg-slate-800"></button>
        </div>
        <input type="hidden" id="accCol" value="bg-indigo-600">`;
    document.getElementById('modalSaveBtn').onclick = () => {
        const n = document.getElementById('accName').value, b = parseFloat(document.getElementById('accBal').value) || 0, c = document.getElementById('accCol').value;
        if(n) { appData.accounts.push({id: Date.now().toString(), name: n, balance: b, color: c}); saveToStorage(); closeModal(); }
    };
    document.getElementById('mainModal').classList.remove('hidden');
}

function setCol(color, el) { 
    document.querySelectorAll('.c-btn').forEach(b => b.classList.remove('ring-4', 'ring-indigo-100'));
    el.classList.add('ring-4', 'ring-indigo-100');
    document.getElementById('accCol').value = color; 
}

function openExpenseModal() {
    document.getElementById('modalTitle').innerText = "Novo Talão";
    const accOptions = appData.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    document.getElementById('modalContent').innerHTML = `
        <input type="text" id="expName" placeholder="Local da Compra" class="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none">
        <select id="expAcc" class="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none">${accOptions}</select>
        <div id="productRows" class="space-y-2"></div>
        <button onclick="addProductRow()" class="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black">+ ITEM</button>
        <h4 id="runningTotal" class="text-2xl font-black text-center mt-4">€ 0.00</h4>`;
    addProductRow();
    document.getElementById('modalSaveBtn').onclick = saveReceipt;
    document.getElementById('mainModal').classList.remove('hidden');
}

function addProductRow() {
    const div = document.createElement('div');
    div.className = "flex gap-2 product-row";
    div.innerHTML = `<input type="text" placeholder="Item" class="p-name flex-1 p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none">
                     <input type="number" placeholder="€" oninput="upTotal()" class="p-price w-20 p-3 bg-slate-50 rounded-xl text-xs font-black text-indigo-600 outline-none">`;
    document.getElementById('productRows').appendChild(div);
}

function upTotal() {
    let t = 0;
    document.querySelectorAll('.product-row').forEach(r => t += parseFloat(r.querySelector('.p-price').value) || 0);
    document.getElementById('runningTotal').innerText = "€ " + t.toFixed(2);
}

function saveReceipt() {
    const name = document.getElementById('expName').value, accId = document.getElementById('expAcc').value, prods = [];
    let total = 0;
    document.querySelectorAll('.product-row').forEach(r => {
        const n = r.querySelector('.p-name').value, p = parseFloat(r.querySelector('.p-price').value) || 0;
        if(n && p) { prods.push({name: n, price: p}); total += p; }
    });
    if(name && total > 0) {
        const acc = appData.accounts.find(a => a.id === accId);
        if(acc.balance >= total) {
            acc.balance -= total;
            appData.months[getMonthKey(currentDate)].expenses.push({id: Date.now().toString(), name, value: total, type: 'esporadica', accountId: accId, products: prods});
            saveToStorage(); closeModal();
        } else { alert("Saldo insuficiente."); }
    }
}

function openIncomeModal() {
    document.getElementById('modalTitle').innerText = "Receber";
    const opt = appData.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    document.getElementById('modalContent').innerHTML = `<input type="number" id="iv" placeholder="Valor €" class="w-full p-4 bg-slate-50 rounded-2xl font-bold"><select id="ia" class="w-full p-4 bg-slate-50 rounded-2xl font-bold">${opt}</select>`;
    document.getElementById('modalSaveBtn').onclick = () => {
        const v = parseFloat(document.getElementById('iv').value), a = appData.accounts.find(x => x.id === document.getElementById('ia').value);
        if(v && a) { a.balance += v; saveToStorage(); closeModal(); }
    };
    document.getElementById('mainModal').classList.remove('hidden');
}

function openTransferModal() {
    if (appData.accounts.length < 2) return alert("Precisas de 2 contas.");
    document.getElementById('modalTitle').innerText = "Transferir";
    const opt = appData.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    document.getElementById('modalContent').innerHTML = `
        <select id="tFrom" class="w-full p-4 bg-slate-50 rounded-2xl font-bold">${opt}</select>
        <select id="tTo" class="w-full p-4 bg-slate-50 rounded-2xl font-bold">${opt}</select>
        <input type="number" id="tVal" placeholder="Valor €" class="w-full p-4 bg-slate-50 rounded-2xl font-bold">`;
    document.getElementById('modalSaveBtn').onclick = () => {
        const fId = document.getElementById('tFrom').value, tId = document.getElementById('tTo').value, v = parseFloat(document.getElementById('tVal').value);
        const f = appData.accounts.find(a => a.id === fId), t = appData.accounts.find(a => a.id === tId);
        if(fId !== tId && f.balance >= v) { f.balance -= v; t.balance += v; saveToStorage(); closeModal(); }
    };
    document.getElementById('mainModal').classList.remove('hidden');
}

function openSavingsModal() {
    const k = getMonthKey(currentDate);
    document.getElementById('modalTitle').innerText = "Reserva";
    document.getElementById('modalContent').innerHTML = `<input type="number" id="sv" value="${appData.months[k].savings}" class="w-full p-4 bg-slate-50 rounded-2xl font-bold text-center">`;
    document.getElementById('modalSaveBtn').onclick = () => {
        appData.months[k].savings = parseFloat(document.getElementById('sv').value) || 0;
        saveToStorage(); closeModal();
    };
    document.getElementById('mainModal').classList.remove('hidden');
}

// 6. AUXILIARES
function deleteAccount(id) {
    if (appData.accounts.length <= 1) return alert("Mantém pelo menos uma.");
    if (confirm("Eliminar conta?")) {
        appData.accounts = appData.accounts.filter(a => a.id !== id);
        saveToStorage();
    }
}

function deleteExpense(id) {
    const k = getMonthKey(currentDate);
    const exp = appData.months[k].expenses.find(e => e.id === id);
    if(exp) {
        const acc = appData.accounts.find(a => a.id === exp.accountId);
        if(acc) acc.balance += exp.value;
        appData.months[k].expenses = appData.months[k].expenses.filter(e => e.id !== id);
        saveToStorage();
    }
}

function renderStats(data) {
    const totalBal = selectedAccountId === 'all' ? appData.accounts.reduce((a, b) => a + b.balance, 0) : (appData.accounts.find(a => a.id === selectedAccountId)?.balance || 0);
    document.getElementById('statFinalBalance').innerText = "€ " + (totalBal - (data.savings || 0)).toFixed(2);
}

function setAccountFilter(id) { selectedAccountId = id; updateUI(); }
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tab + 'Section').classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(tab + 'TabBtn').classList.add('nav-active');
}
function changeMonth(s) { currentDate.setMonth(currentDate.getMonth() + s); setupCurrentMonth(); updateUI(); }
function closeModal() { document.getElementById('mainModal').classList.add('hidden'); }

init();