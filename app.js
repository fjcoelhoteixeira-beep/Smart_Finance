// 1. ESTADO INICIAL DA APLICAÇÃO
let appData = JSON.parse(localStorage.getItem('financeData_V5')) || {
    accounts: [{ id: '1', name: 'Principal', balance: 0, color: 'bg-indigo-600' }],
    months: {}
};

let currentDate = new Date();
let currentType = 'esporadica';
let selectedAccountId = 'all';
const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// 2. INICIALIZAÇÃO
let appData = { accounts: [], months: {} };

function init() {
    // Escuta mudanças na base de dados em tempo real
    db.ref('smartFinanceData').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            appData = data;
        } else {
            // Se a BD estiver vazia, cria o estado inicial
            appData = {
                accounts: [{ id: '1', name: 'Principal', balance: 0, color: 'bg-indigo-600' }],
                months: {}
            };
            saveToStorage(); // Grava o inicial na BD
        }
        setupCurrentMonth();
        updateUI();
    });
}

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
            expenses: prevData ? prevData.expenses.filter(e => e.type === 'fixa') : []
        };
        saveToStorage();
    }
}

// 3. ATUALIZAÇÃO DA INTERFACE (UI)
function updateUI() {
    const key = getMonthKey(currentDate);
    const data = appData.months[key];
    
    document.getElementById('currentMonthDisplay').innerText = monthNames[currentDate.getMonth()] + " " + currentDate.getFullYear();

    renderAccounts(data);
    renderReceipts(data);
    renderStats(data);
}

function renderAccounts(data) {
    const list = document.getElementById('accountsList');
    if (!list) return;

    const totalGlobal = appData.accounts.reduce((acc, curr) => acc + curr.balance, 0);
    document.getElementById('globalBalanceDisplay').innerText = "Saldo Global: € " + totalGlobal.toFixed(2);

    list.innerHTML = appData.accounts.map(acc => {
        const isSelected = selectedAccountId === acc.id;
        const activeClass = isSelected ? 'ring-4 ring-white/50 scale-105' : 'opacity-40 hover:opacity-60';
        
        return `
            <div onclick="setAccountFilter('${acc.id}')" 
                 class="min-w-[160px] ${acc.color} p-5 rounded-[2.5rem] shadow-lg text-white relative cursor-pointer transition-all ${activeClass}">
                
                <button onclick="event.stopPropagation(); deleteAccount('${acc.id}')" 
                        class="absolute top-4 right-4 w-6 h-6 bg-black/10 hover:bg-black/20 rounded-full flex items-center justify-center transition-colors">
                    <i class="bi bi-x text-xs"></i>
                </button>

                <p class="text-[9px] opacity-70 uppercase font-bold tracking-[0.15em] mb-1">${acc.name}</p>
                <p class="text-xl font-extrabold italic">€${acc.balance.toFixed(2)}</p>
            </div>
        `;
    }).join('');

    let activeBalance = totalGlobal;
    if(selectedAccountId !== 'all') {
        const acc = appData.accounts.find(a => a.id === selectedAccountId);
        activeBalance = acc ? acc.balance : 0;
        document.getElementById('walletLabel').innerText = "Saldo: " + (acc ? acc.name : "");
    } else {
        document.getElementById('walletLabel').innerText = "Saldo Consolidado";
    }

    document.getElementById('walletMainBalance').innerText = "€ " + activeBalance.toFixed(2);
    document.getElementById('displaySavings').innerText = "€ " + (data.savings || 0).toFixed(2);
}

// 4. GESTÃO DE DESPESAS E TALÕES
function renderReceipts(data) {
    const feed = document.getElementById('receiptsFeed');
    const filtered = selectedAccountId === 'all' ? data.expenses : data.expenses.filter(e => e.accountId === selectedAccountId);
    
    document.getElementById('filterStatus').classList.toggle('hidden', selectedAccountId === 'all');

    if (filtered.length === 0) {
        feed.innerHTML = `<div class="text-center py-20 opacity-20 font-extrabold uppercase text-[10px] tracking-[0.3em]">Nenhum movimento</div>`;
        return;
    }

    feed.innerHTML = filtered.map(rec => {
        const acc = appData.accounts.find(a => a.id === rec.accountId);
        const isTransfer = rec.type === 'transferência';
        
        return `
            <div class="receipt-paper animate-fadeIn shadow-sm mb-6">
                <div class="p-6 border-b border-dashed border-slate-100 flex justify-between items-start">
                    <div>
                        <span class="text-[8px] font-extrabold uppercase tracking-widest ${isTransfer ? 'text-indigo-500' : 'text-rose-400'}">${rec.type}</span>
                        <h3 class="font-extrabold text-lg text-slate-800 mt-0.5 tracking-tight">${rec.name}</h3>
                        <p class="text-[10px] font-bold text-slate-300 uppercase">${acc ? acc.name : 'Conta Geral'}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xl font-extrabold text-slate-900 font-mono italic">€${rec.value.toFixed(2)}</p>
                        <button onclick="deleteExpense('${rec.id}')" class="text-slate-200 hover:text-rose-500 transition-colors mt-2"><i class="bi bi-trash3-fill text-xs"></i></button>
                    </div>
                </div>
                <div class="p-6 bg-slate-50/20">
                    <div class="space-y-2">
                        ${rec.products.map(p => `
                            <div class="flex justify-between items-center">
                                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">${p.name}</span>
                                <span class="text-[10px] font-black text-slate-400 font-mono">€${parseFloat(p.price).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).reverse().join('');
}

// 5. MODAIS E LOGICA DE NEGÓCIO (Cores, Contas, etc)
function openAccountModal() {
    document.getElementById('modalTitle').innerText = "Nova Conta";
    document.getElementById('modalContent').innerHTML = `
        <div class="space-y-4">
            <input type="text" id="accName" placeholder="Nome da Conta" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
            <input type="number" id="accBal" placeholder="Saldo Inicial €" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
            <div class="flex justify-between py-2">
                <button onclick="setCol('bg-indigo-600', this)" class="c-btn w-10 h-10 rounded-full bg-indigo-600 ring-4 ring-indigo-100 transition-all"></button>
                <button onclick="setCol('bg-emerald-500', this)" class="c-btn w-10 h-10 rounded-full bg-emerald-500 transition-all"></button>
                <button onclick="setCol('bg-rose-500', this)" class="c-btn w-10 h-10 rounded-full bg-rose-500 transition-all"></button>
                <button onclick="setCol('bg-slate-800', this)" class="c-btn w-10 h-10 rounded-full bg-slate-800 transition-all"></button>
            </div>
            <input type="hidden" id="accCol" value="bg-indigo-600">
        </div>
    `;
    document.getElementById('modalSaveBtn').onclick = saveAccount;
    document.getElementById('mainModal').classList.remove('hidden');
}

function setCol(color, el) { 
    document.querySelectorAll('.c-btn').forEach(b => b.classList.remove('ring-4', 'ring-indigo-100', 'scale-110'));
    el.classList.add('ring-4', 'ring-indigo-100', 'scale-110');
    document.getElementById('accCol').value = color; 
}

function saveAccount() {
    const n = document.getElementById('accName').value;
    const b = parseFloat(document.getElementById('accBal').value) || 0;
    const c = document.getElementById('accCol').value;
    if(n) {
        appData.accounts.push({id: Date.now().toString(), name: n, balance: b, color: c});
        saveToStorage();
        closeModal();
    }
}

function deleteAccount(id) {
    if (appData.accounts.length <= 1) return alert("Mantém pelo menos uma conta.");
    if (confirm("Eliminar conta?")) {
        appData.accounts = appData.accounts.filter(a => a.id !== id);
        if (selectedAccountId === id) selectedAccountId = 'all';
        saveToStorage();
    }
}

// 6. FUNÇÕES AUXILIARES (Transferir, Poupar, Stats)
function openTransferModal() {
    if (appData.accounts.length < 2) return alert("Precisas de 2 contas.");
    document.getElementById('modalTitle').innerText = "Transferir";
    const opt = appData.accounts.map(a => `<option value="${a.id}">${a.name} (€${a.balance.toFixed(2)})</option>`).join('');
    document.getElementById('modalContent').innerHTML = `
        <select id="tFrom" class="w-full p-4 bg-slate-50 rounded-2xl font-bold">${opt}</select>
        <select id="tTo" class="w-full p-4 bg-slate-50 rounded-2xl font-bold">${opt}</select>
        <input type="number" id="tVal" placeholder="Valor €" class="w-full p-6 bg-slate-50 rounded-3xl font-black text-3xl text-center">
    `;
    document.getElementById('modalSaveBtn').onclick = () => {
        const fId = document.getElementById('tFrom').value, tId = document.getElementById('tTo').value, v = parseFloat(document.getElementById('tVal').value);
        if(fId !== tId && v > 0) {
            const f = appData.accounts.find(x => x.id === fId), t = appData.accounts.find(x => x.id === tId);
            if(f.balance >= v) {
                f.balance -= v; t.balance += v;
                appData.months[getMonthKey(currentDate)].expenses.push({
                    id: Date.now().toString(), name: "Transferência Interna", value: v, type: 'transferência', accountId: fId, products: [{name: f.name + " para " + t.name, price: v}]
                });
                saveToStorage(); closeModal();
            } else { alert("Saldo insuficiente."); }
        }
    };
    document.getElementById('mainModal').classList.remove('hidden');
}

// Restantes funções obrigatórias
function renderStats(data) {
    const container = document.getElementById('statsContainer');
    const filtered = selectedAccountId === 'all' ? data.expenses : data.expenses.filter(e => e.accountId === selectedAccountId);
    const totalBalance = selectedAccountId === 'all' ? appData.accounts.reduce((a, b) => a + b.balance, 0) : (appData.accounts.find(a => a.id === selectedAccountId)?.balance || 0);
    const fixed = filtered.filter(e => e.type === 'fixa').reduce((a, b) => a + b.value, 0);
    const esporadica = filtered.filter(e => e.type === 'esporadica').reduce((a, b) => a + b.value, 0);
    document.getElementById('statFinalBalance').innerText = "€ " + (totalBalance - data.savings).toFixed(2);
    container.innerHTML = ""; // Limpa antes de renderizar
}

function openExpenseModal() {
    document.getElementById('modalTitle').innerText = "Novo Talão";
    const accOptions = appData.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    document.getElementById('modalContent').innerHTML = `
        <input type="text" id="expName" placeholder="Local da Compra" class="w-full p-4 bg-slate-50 rounded-2xl font-bold">
        <select id="expAcc" class="w-full p-4 bg-slate-50 rounded-2xl font-bold">${accOptions}</select>
        <div id="productRows" class="space-y-2"></div>
        <button onclick="addProductRow()" class="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black">+ ITEM</button>
        <h4 id="runningTotal" class="text-2xl font-black text-center">€ 0.00</h4>
    `;
    addProductRow();
    document.getElementById('modalSaveBtn').onclick = saveReceipt;
    document.getElementById('mainModal').classList.remove('hidden');
}

function addProductRow() {
    const div = document.createElement('div');
    div.className = "flex gap-2 product-row";
    div.innerHTML = `<input type="text" placeholder="Item" class="p-name flex-1 p-3 bg-slate-50 rounded-xl text-xs font-bold">
                     <input type="number" placeholder="€" oninput="upTotal()" class="p-price w-20 p-3 bg-slate-50 rounded-xl text-xs font-black text-indigo-600">`;
    document.getElementById('productRows').appendChild(div);
}

function upTotal() {
    let t = 0;
    document.querySelectorAll('.product-row').forEach(r => t += parseFloat(r.querySelector('.p-price').value) || 0);
    document.getElementById('runningTotal').innerText = "€ " + t.toFixed(2);
}

function saveReceipt() {
    const name = document.getElementById('expName').value;
    const accId = document.getElementById('expAcc').value;
    const prods = [];
    let total = 0;
    document.querySelectorAll('.product-row').forEach(r => {
        const n = r.querySelector('.p-name').value;
        const p = parseFloat(r.querySelector('.p-price').value) || 0;
        if(n && p) { prods.push({name: n, price: p}); total += p; }
    });
    if(name && total > 0) {
        const acc = appData.accounts.find(a => a.id === accId);
        if(acc.balance < total) return alert("Saldo insuficiente.");
        appData.months[getMonthKey(currentDate)].expenses.push({
            id: Date.now().toString(), name, value: total, type: 'esporadica', accountId: accId, products: prods
        });
        acc.balance -= total;
        saveToStorage(); closeModal();
    }
}

function deleteExpense(id) {
    const k = getMonthKey(currentDate);
    const e = appData.months[k].expenses.find(x => x.id === id);
    if(e) {
        const a = appData.accounts.find(x => x.id === e.accountId);
        if(a) a.balance += e.value;
        appData.months[k].expenses = appData.months[k].expenses.filter(x => x.id !== id);
        saveToStorage();
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

function setAccountFilter(id) { selectedAccountId = id; updateUI(); }
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tab + 'Section').classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active', 'text-indigo-600'));
    document.getElementById(tab + 'TabBtn').classList.add('nav-active', 'text-indigo-600');
}
function changeMonth(s) { currentDate.setMonth(currentDate.getMonth() + s); setupCurrentMonth(); updateUI(); }
function closeModal() { document.getElementById('mainModal').classList.add('hidden'); }
function saveToStorage() { localStorage.setItem('financeData_V5', JSON.stringify(appData)); updateUI(); }

init();