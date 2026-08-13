// ========================================
// VARIÁVEIS GLOBAIS
// ========================================
let pesos = [];
let relatorios = [];
let audioCtx = null;
let indicePesoParaExcluir = null;

// ========================================
// SISTEMA DE SOM (BIP)
// ========================================
function bip(){
    try {
        if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let oscillator = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        oscillator.connect(gain);
        gain.connect(audioCtx.destination);
        oscillator.frequency.value = 900;
        oscillator.type = "square";
        gain.gain.value = 0.2;
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.08);
    } catch(e){}
}

// ========================================
// NAVEGAÇÃO E TELAS
// ========================================
function trocarTela(id){
    document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
    let telaAlvo = document.getElementById(id);
    if(telaAlvo) {
        telaAlvo.classList.add("ativa");
    }
}

function abrirRelatorios(){
    trocarTela("telaResultado");
    mostrarRelatorios();
}

function abrirDashboard(){
    trocarTela("telaDashboard");
    preencherFiltrosDashboard();
    mostrarDashboard();
    if(typeof mostrarPatrimonio === "function") mostrarPatrimonio();
    if(typeof mostrarEvolucaoPatrimonio === "function") mostrarEvolucaoPatrimonio();
    if(typeof mostrarResultadoMensal === "function") mostrarResultadoMensal();
    if(typeof mostrarCustoPorLote === "function") mostrarCustoPorLote();
}

function iniciarPesagem(){
    let nv = document.getElementById("nomeVendedor");
    let vKg = document.getElementById("valorKg");
    let tipoPesagemEl = document.getElementById("tipoPesagem");
    let rendEl = document.getElementById("rendimentoArroba");

    if(!nv || !nv.value.trim()){
        alert("Preencha o nome do vendedor!");
        return;
    }
    if(!vKg || !vKg.value.trim()){
        alert("Preencha o valor por kg/arroba!");
        return;
    }
    if(tipoPesagemEl && tipoPesagemEl.value === "arroba" && (!rendEl || !rendEl.value.trim())){
        alert("Preencha o % de rendimento da arroba!");
        return;
    }

    let tipoOperacaoEl = document.getElementById("tipoOperacao");
    if(tipoOperacaoEl && tipoOperacaoEl.value === "compra" && obterPapelLogado() !== "admin"){
        let limite = obterValorMaximoCompra();
        if(limite !== null){
            let valorDigitado = parseFloat(vKg.value.replace("R$ ", "").replace(/\./g, "").replace(",", "."));
            if(valorDigitado > limite){
                alert("Valor de compra não autorizado, consulte o administrador.");
                return;
            }
        }
    }

    trocarTela("telaPesagem");
    atualizarStats();
}

function alternarTipoPesagem(){
    let tipoPesagemEl = document.getElementById("tipoPesagem");
    let rendEl = document.getElementById("rendimentoArroba");
    let vKgEl = document.getElementById("valorKg");
    if(!tipoPesagemEl || !rendEl) return;

    let ehArroba = tipoPesagemEl.value === "arroba";
    rendEl.style.display = ehArroba ? "block" : "none";
    if(vKgEl) vKgEl.placeholder = ehArroba ? "Valor por Arroba (R$)" : "Valor por kg (R$)";
}

function resetarPesagemAtual() {
    pesos = [];

    let nv = document.getElementById("nomeVendedor");
    let desc = document.getElementById("descricao");
    let obs = document.getElementById("obs");
    let vKg = document.getElementById("valorKg");
    let dPeso = document.getElementById("displayPeso");
    let tipoEl = document.getElementById("tipoOperacao");
    let tipoPesagemEl = document.getElementById("tipoPesagem");
    let rendEl = document.getElementById("rendimentoArroba");

    if(nv) nv.value = "";
    if(desc) desc.value = "";
    if(obs) obs.value = "";
    if(vKg) vKg.value = "";
    if(dPeso) dPeso.value = "";
    if(tipoEl) tipoEl.value = "venda";
    if(tipoPesagemEl) tipoPesagemEl.value = "vivo";
    if(rendEl) rendEl.value = "";
    alternarTipoPesagem();
    aplicarRestricoesUsuario();

    localStorage.removeItem("pesagemAtual");
    atualizarStats();
    trocarTela("telaInicial");
}

// ========================================
// MODAL CANCELAR / FINALIZAR PESAGEM (ARRASTE)
// ========================================
let acaoModalPendente = null;

function solicitarCancelarPesagem(){
    if(pesos.length === 0){
        resetarPesagemAtual();
        return;
    }
    acaoModalPendente = "cancelar";
    document.getElementById("modalAcaoTitulo").innerText = "⚠️ Cancelar Pesagem";
    document.getElementById("modalAcaoTexto").innerText = "Tem certeza que deseja cancelar esta pesagem?";
    document.getElementById("linhaCheckboxCiente").style.display = "flex";
    document.getElementById("checkboxCiente").checked = false;
    document.getElementById("modalConfirmarAcao").style.display = "flex";
}

function solicitarFinalizarPesagem(){
    acaoModalPendente = "finalizar";
    document.getElementById("modalAcaoTitulo").innerText = "✅ Finalizar Pesagem";
    document.getElementById("modalAcaoTexto").innerText = "Tem certeza que deseja finalizar esta pesagem?";
    document.getElementById("linhaCheckboxCiente").style.display = "none";
    document.getElementById("modalConfirmarAcao").style.display = "flex";
}

function fecharModalAcao(){
    document.getElementById("modalConfirmarAcao").style.display = "none";
    acaoModalPendente = null;
}

function confirmarModalAcao(){
    if(acaoModalPendente === "cancelar"){
        let checkbox = document.getElementById("checkboxCiente");
        if(checkbox && !checkbox.checked){
            alert("Marque a caixinha confirmando que está ciente da perda dos dados.");
            return;
        }
        document.getElementById("modalConfirmarAcao").style.display = "none";
        acaoModalPendente = null;
        resetarPesagemAtual();
    } else if(acaoModalPendente === "finalizar"){
        document.getElementById("modalConfirmarAcao").style.display = "none";
        acaoModalPendente = null;
        finalizarPesagem();
    }
}

// ========================================
// FLUXO DE PESAGEM
// ========================================
function adicionarPeso(){
    let inputPeso = document.getElementById("displayPeso");
    let inputObs = document.getElementById("obs");
    if(!inputPeso) return;
    
    let pesoNum = parseFloat(inputPeso.value.replace(",", "."));

    if(!pesoNum || pesoNum <= 0){
        alert("Digite um peso válido!");
        return;
    }

    pesos.push({
        peso: pesoNum,
        obs: inputObs ? inputObs.value.trim() : ""
    });

    bip();
    inputPeso.value = "";
    if(inputObs) inputObs.value = "";
    
    if(typeof salvarPesagemAuto === "function") {
        salvarPesagemAuto();
    }
    atualizarStats();
}

function excluirPesoItem(idx){
    indicePesoParaExcluir = idx;
    let modal = document.getElementById("modalConfirmacao");
    if(modal) modal.style.display = "flex";
}

function fecharConfirmacao(confirmado){
    let modal = document.getElementById("modalConfirmacao");
    if(modal) modal.style.display = "none";
    if(confirmado && indicePesoParaExcluir !== null){
        pesos.splice(indicePesoParaExcluir, 1);
        if(typeof salvarPesagemAuto === "function") {
            salvarPesagemAuto();
        }
        atualizarStats();
    }
    indicePesoParaExcluir = null;
}

function finalizarPesagem(){
    if(pesos.length === 0){
        alert("Nenhum peso lançado!");
        return;
    }

    if(typeof salvarPesagem === "function") {
        salvarPesagem();
    }
    pesos = [];
    relatorios = JSON.parse(localStorage.getItem("pesagens") || "[]");

    alert("Pesagem salva com sucesso!");
    abrirRelatorios();
}

// ========================================
// REQUISITOS E ESTATÍSTICAS
// ========================================
function formatarPeso(n){
    n = Number(n) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

function formatarMoeda(n){
    n = Number(n) || 0;
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function converterParaArroba(pesoKg, rendimentoPct){
    return (pesoKg * rendimentoPct / 100) / 15;
}

function atualizarStats(){
    let qtd = pesos.length;
    let total = pesos.reduce((a, b) => a + b.peso, 0);
    let media = qtd > 0 ? (total / qtd) : 0;
    let ultimo = qtd > 0 ? pesos[qtd - 1].peso : 0;

    let vKgEl = document.getElementById("valorKg");
    let valorKgTexto = vKgEl ? vKgEl.value : "0";
    let valorKgNum = parseFloat(valorKgTexto.replace("R$ ", "").replace(/\./g, "").replace(",", ".")) || 0;

    let tipoPesagemEl = document.getElementById("tipoPesagem");
    let ehArroba = tipoPesagemEl ? tipoPesagemEl.value === "arroba" : false;
    let rendEl = document.getElementById("rendimentoArroba");
    let rendimentoNum = rendEl ? (parseFloat(rendEl.value.replace(",", ".")) || 0) : 0;

    let ultimoArroba = converterParaArroba(ultimo, rendimentoNum);
    let totalArroba = converterParaArroba(total, rendimentoNum);
    let mediaArroba = qtd > 0 ? (totalArroba / qtd) : 0;

    let ultimoValor = (ehArroba ? ultimoArroba : ultimo) * valorKgNum;
    let totalValor = (ehArroba ? totalArroba : total) * valorKgNum;

    let qtdEl = document.getElementById("qtd");
    let medEl = document.getElementById("media");
    let totEl = document.getElementById("total");
    let ultEl = document.getElementById("ultimo");
    let uValEl = document.getElementById("ultimoValor");
    let tValEl = document.getElementById("totalValor");
    let cardUltimoKgEl = document.getElementById("cardUltimoKg");
    let cardUltimoValorEl = document.getElementById("cardUltimoValor");
    let cardTotalArrobaEl = document.getElementById("cardTotalArroba");
    let cardMediaArrobaEl = document.getElementById("cardMediaArroba");
    let totalArrobaEl = document.getElementById("totalArroba");
    let mediaArrobaEl = document.getElementById("mediaArroba");

    if(qtdEl) qtdEl.innerText = qtd;
    if(medEl) medEl.innerText = media.toFixed(2).replace(".", ",");
    if(totEl) totEl.innerText = formatarPeso(total);
    if(ultEl) ultEl.innerText = formatarPeso(ultimo);
    if(uValEl) uValEl.innerText = "R$ " + formatarMoeda(ultimoValor);
    if(tValEl) tValEl.innerText = "R$ " + formatarMoeda(totalValor);

    if(cardUltimoKgEl) cardUltimoKgEl.style.display = ehArroba ? "none" : "block";
    if(cardUltimoValorEl) cardUltimoValorEl.style.display = ehArroba ? "none" : "block";
    if(cardTotalArrobaEl) cardTotalArrobaEl.style.display = ehArroba ? "block" : "none";
    if(cardMediaArrobaEl) cardMediaArrobaEl.style.display = ehArroba ? "block" : "none";
    if(totalArrobaEl) totalArrobaEl.innerText = totalArroba.toFixed(2).replace(".", ",");
    if(mediaArrobaEl) mediaArrobaEl.innerText = mediaArroba.toFixed(2).replace(".", ",");

    let listaHTML = "";
    if(pesos.length === 0){
        listaHTML = `<div class="listaPesosAtualVazia">Nenhum peso lançado ainda</div>`;
    } else {
        [...pesos].reverse().forEach((p, idx) => {
            let originalIdx = pesos.length - 1 - idx;
            let arrobaItem = converterParaArroba(p.peso, rendimentoNum);
            let valorItem = (ehArroba ? arrobaItem : p.peso) * valorKgNum;
            let textoArroba = ehArroba ? ` (${arrobaItem.toFixed(2).replace(".", ",")} @)` : "";
            listaHTML += `
                <div class="itemPesagem">
                    <span>#${originalIdx + 1} - <b>${formatarPeso(p.peso)} kg</b>${textoArroba} ${p.obs ? `(${p.obs})` : ''}</span>
                    <span class="itemPesagemDireita">
                        <span style="color:#2e7d32">R$ ${formatarMoeda(valorItem)}</span>
                        <button class="btnExcluirItem" onclick="excluirPesoItem(${originalIdx})">🗑</button>
                    </span>
                </div>
            `;
        });
    }

    let containerLista = document.getElementById("listaPesosAtual");
    if(containerLista) containerLista.innerHTML = listaHTML;
}

function mostrarRelatorios(){
    let container = document.getElementById("listaRelatorios");
    if(!container) return;

    // O índice usado no valor do rádio (originalIndex) precisa sempre apontar
    // pra posição real dentro do array "relatorios" completo — mesmo quando a
    // lista exibida está filtrada por permissão — porque excluirSelecionado(),
    // gerarPDF(), exportarExcel() e prepararImpressao() usam relatorios[valor]
    // diretamente.
    let restringir = obterPapelLogado() !== "admin" && obterPermRelatorios() === "proprio";
    let meuNome = obterUsuarioLogado();
    let itens = relatorios
        .map((r, idx) => ({ r, originalIndex: idx }))
        .filter(item => !restringir || item.r.criadoPor === meuNome);

    if(itens.length === 0){
        container.innerHTML = "<p style='text-align:center; padding:20px; color:#666;'>Nenhum relatório salvo.</p>";
        return;
    }

    let html = "";
    [...itens].reverse().forEach(item => {
        let r = item.r;
        let originalIndex = item.originalIndex;
        let totalKg = r.pesos ? r.pesos.reduce((a, b) => a + (b.peso || 0), 0) : 0;
        let tipo = r.tipo || "venda";
        let tagTipo = tipo === "compra"
            ? `<span class="tagTipo tagTipoCompra">COMPRA</span>`
            : `<span class="tagTipo tagTipoVenda">VENDA</span>`;

        let numeroTexto = r.numero ? ("Nº " + r.numero) : "Pendente";

        html += `
            <div class="cardRelatorio">
                <label>
                    <input type="radio" name="relatorioSelecionado" value="${originalIndex}">
                    <div class="infoRelatorio">
                        ${tagTipo} <span class="numeroRelatorio">${numeroTexto}</span><br>
                        <b>Vendedor:</b> ${r.vendedor || "Não informado"}<br>
                        <b>Lote/Descrição:</b> ${r.descricao || "Sem descrição"}<br>
                        <b>Data:</b> ${r.data || "Sem data"}<br>
                        ${r.criadoPor ? `<b>Lançado por:</b> ${r.criadoPor}<br>` : ""}
                        <b>Animais:</b> ${r.pesos ? r.pesos.length : 0} | <b>Total:</b> ${formatarPeso(totalKg)} kg
                    </div>
                </label>
            </div>
        `;
    });
    container.innerHTML = html;
}

function filtrarRelatorios() {
    let buscaEl = document.getElementById("buscarVendedor");
    let busca = buscaEl ? buscaEl.value.toLowerCase() : "";
    document.querySelectorAll(".cardRelatorio").forEach(card => {
        let texto = card.innerText.toLowerCase();
        card.style.display = texto.includes(busca) ? "block" : "none";
    });
}

function extrairMesAnoDaData(dataStr){
    let match = String(dataStr || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if(!match) return null;
    return { mes: parseInt(match[2], 10) - 1, ano: parseInt(match[3], 10) };
}

// Converte "dd/mm/yyyy, hh:mm:ss" (formato usado em todo o sistema) pra
// "yyyy-mm-dd" — ordena como string igual uma data real e compara direto
// com o valor de um <input type="date">.
function extrairDataISO(dataStr){
    let match = String(dataStr || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if(!match) return null;
    return `${match[3]}-${match[2]}-${match[1]}`;
}

// Caminho inverso: "yyyy-mm-dd" (valor de <input type="date">) vira
// "dd/mm/yyyy, hh:mm:ss" com o horário atual, pra manter o mesmo formato
// de todas as outras datas do sistema.
function formatarDataBR(dataISOSimples){
    let [ano, mes, dia] = String(dataISOSimples || "").split("-");
    if(!ano || !mes || !dia) return new Date().toLocaleString("pt-BR");
    let agora = new Date();
    let hora = String(agora.getHours()).padStart(2, "0");
    let min = String(agora.getMinutes()).padStart(2, "0");
    let seg = String(agora.getSeconds()).padStart(2, "0");
    return `${dia}/${mes}/${ano}, ${hora}:${min}:${seg}`;
}

function preencherFiltrosDashboard(){
    let filtroAnoEl = document.getElementById("filtroAno");
    if(filtroAnoEl){
        let anoSelecionado = filtroAnoEl.value;
        let anos = new Set();
        relatorios.forEach(r => {
            let dm = extrairMesAnoDaData(r.data);
            if(dm) anos.add(dm.ano);
        });
        let anosOrdenados = Array.from(anos).sort((a, b) => b - a);
        filtroAnoEl.innerHTML = `<option value="">Ano: Todos</option>` +
            anosOrdenados.map(a => `<option value="${a}">${a}</option>`).join("");
        filtroAnoEl.value = anosOrdenados.includes(parseInt(anoSelecionado, 10)) ? anoSelecionado : "";
    }

    let filtroLoteEl = document.getElementById("filtroLote");
    if(filtroLoteEl){
        let loteSelecionado = filtroLoteEl.value;
        let lotes = JSON.parse(localStorage.getItem("lotesCache") || "[]");
        filtroLoteEl.innerHTML = `<option value="">Lote: Todos</option>` +
            `<option value="Sem descrição">Sem lote</option>` +
            lotes.map(l => `<option value="${l.nome.replace(/"/g, "&quot;")}">${l.nome}</option>`).join("");
        filtroLoteEl.value = loteSelecionado;
    }
}

function limparFiltrosDashboard(){
    let filtroMesEl = document.getElementById("filtroMes");
    let filtroAnoEl = document.getElementById("filtroAno");
    let filtroLoteEl = document.getElementById("filtroLote");
    if(filtroMesEl) filtroMesEl.value = "";
    if(filtroAnoEl) filtroAnoEl.value = "";
    if(filtroLoteEl) filtroLoteEl.value = "";
    mostrarDashboard();
}

function mostrarDashboard(){
    let animaisComprados = 0, animaisVendidos = 0;
    let kgCompra = 0, kgVenda = 0;
    let valorCompra = 0, valorVenda = 0;

    let baseDashboard = relatorios;
    if(obterPapelLogado() !== "admin" && obterPermDashboard() === "proprio"){
        let meuNome = obterUsuarioLogado();
        baseDashboard = relatorios.filter(r => r.criadoPor === meuNome);
    }

    let filtroMesEl = document.getElementById("filtroMes");
    let filtroAnoEl = document.getElementById("filtroAno");
    let filtroLoteEl = document.getElementById("filtroLote");
    let mesFiltro = filtroMesEl && filtroMesEl.value !== "" ? parseInt(filtroMesEl.value, 10) : null;
    let anoFiltro = filtroAnoEl && filtroAnoEl.value !== "" ? parseInt(filtroAnoEl.value, 10) : null;
    let loteFiltro = filtroLoteEl && filtroLoteEl.value !== "" ? filtroLoteEl.value : null;

    if(mesFiltro !== null || anoFiltro !== null){
        baseDashboard = baseDashboard.filter(r => {
            let dm = extrairMesAnoDaData(r.data);
            if(!dm) return false;
            if(mesFiltro !== null && dm.mes !== mesFiltro) return false;
            if(anoFiltro !== null && dm.ano !== anoFiltro) return false;
            return true;
        });
    }
    if(loteFiltro !== null){
        baseDashboard = baseDashboard.filter(r => (r.descricao || "Sem descrição") === loteFiltro);
    }

    baseDashboard.forEach(r => {
        let tipo = r.tipo || "venda";
        let d = calcularDadosCompletos(r);

        if(tipo === "compra"){
            animaisComprados += d.totalAnimais;
            kgCompra += d.totalKg;
            valorCompra += d.totalRS;
        } else {
            animaisVendidos += d.totalAnimais;
            kgVenda += d.totalKg;
            valorVenda += d.totalRS;
        }
    });

    let animaisAtivos = animaisComprados - animaisVendidos;
    let saldo = valorVenda - valorCompra;
    let kgTotal = kgCompra + kgVenda;
    let animaisTotal = animaisComprados + animaisVendidos;

    function set(id, texto){
        let el = document.getElementById(id);
        if(el) el.innerText = texto;
    }
    function setLargura(id, valor, maximo){
        let el = document.getElementById(id);
        if(!el) return;
        el.style.width = (maximo > 0 ? (valor / maximo * 100) : 0) + "%";
    }

    set("dashAtivos", animaisAtivos);
    set("dashComprados", animaisComprados);
    set("dashVendidos", animaisVendidos);
    set("dashKgCompra", formatarPeso(kgCompra));
    set("dashKgVenda", formatarPeso(kgVenda));
    set("dashValorCompra", "R$ " + formatarMoeda(valorCompra));
    set("dashValorVenda", "R$ " + formatarMoeda(valorVenda));

    // cartões extras e comparativo Compra x Venda (só existem na tela de gerenciamento)
    let elSaldo = document.getElementById("dashSaldo");
    if(elSaldo){
        let positivo = saldo >= 0;
        elSaldo.innerText = (positivo ? "▲ R$ " : "▼ R$ ") + formatarMoeda(Math.abs(saldo));
        elSaldo.style.color = positivo ? "#0ca30c" : "#d03b3b";
    }
    set("dashKgTotal", formatarPeso(kgTotal) + " kg");
    set("dashAnimaisTotal", animaisTotal);

    setLargura("barAnimaisCompra", animaisComprados, Math.max(animaisComprados, animaisVendidos));
    setLargura("barAnimaisVenda", animaisVendidos, Math.max(animaisComprados, animaisVendidos));
    setLargura("barKgCompra", kgCompra, Math.max(kgCompra, kgVenda));
    setLargura("barKgVenda", kgVenda, Math.max(kgCompra, kgVenda));
    setLargura("barValorCompra", valorCompra, Math.max(valorCompra, valorVenda));
    setLargura("barValorVenda", valorVenda, Math.max(valorCompra, valorVenda));
}

function formatarValorKg(input) {
    let numero = Number(input.value.replace(/\D/g, "")) / 100;
    input.value = numero === 0 ? "" : "R$ " + formatarMoeda(numero);
    atualizarStats();
}

// ========================================
// EXPORTAÇÃO PDF NATIVA (CAPACITOR)
// ========================================
async function gerarPDF() {
    try {
        let sel = document.querySelector("input[name='relatorioSelecionado']:checked");
        if (!sel) { 
            alert("Selecione um relatório primeiro!"); 
            return; 
        }

        let indiceReal = parseInt(sel.value);
        let r = relatorios[indiceReal];
        if (!r || !r.pesos) {
            alert("Erro ao ler os dados do relatório selecionado.");
            return;
        }

        let d = calcularDadosCompletos(r);

        const { jsPDF } = window.jspdf;
        let pdf = new jsPDF();

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(20);
        pdf.text("RELATÓRIO DE PESAGEM", 105, 20, { align: "center" });
        if(r.numero){
            pdf.setFontSize(12);
            pdf.text(`Nº ${r.numero}`, 200, 20, { align: "right" });
        }
        pdf.line(10, 25, 200, 25);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        let y = 35;

        pdf.text(`Vendedor: ${r.vendedor || 'Geral'}`, 10, y);
        pdf.text(`Data/Hora: ${d.dataHora}`, 110, y);
        
        y += 7;
        pdf.text(`Lote/Desc: ${r.descricao || 'Sem Descrição'}`, 10, y);
        pdf.text(`Valor base/kg: R$ ${formatarMoeda(d.valorKgNum)}`, 110, y);
        
        y += 7;
        pdf.text(`Total de Cabeças: ${d.totalAnimais}`, 10, y);
        pdf.text(`Peso Acumulado: ${formatarPeso(d.totalKg)} kg`, 110, y);
        
        y += 7;
        pdf.text(`Faturamento Lote: R$ ${formatarMoeda(d.totalRS)}`, 10, y);
        pdf.text(`Média por Animal: ${d.mediaKg.toFixed(2).replace(".", ",")} kg`, 110, y);

        if(d.ehArroba){
            y += 7;
            pdf.text(`Total em Arrobas: ${d.totalArroba.toFixed(2).replace(".", ",")} @ (Rend. ${d.rendimentoNum}%)`, 10, y);
        }

        y += 10;
        pdf.setFont("helvetica", "bold");
        pdf.text(`3 Mais Leves: ${d.leves}`, 10, y);
        y += 7;
        pdf.text(`3 Mais Pesados: ${d.pesados}`, 10, y);
        
        y += 12;
        pdf.line(10, y - 5, 200, y - 5);
        pdf.text("Nº", 10, y);
        pdf.text("Peso (kg)", 40, y);
        pdf.text("Valor Individual", 90, y);
        pdf.text("Observação", 150, y);
        pdf.line(10, y + 2, 200, y + 2);
        
        pdf.setFont("helvetica", "normal");
        y += 8;

        r.pesos.forEach((p, i) => {
            if (y > 270) {
                pdf.addPage();
                y = 20;
            }
            
            let pAtual = p.peso || 0;
            let valorInd = (d.ehArroba ? d.arrobaDe(pAtual) : pAtual) * d.valorKgNum;
            pdf.text(String(i + 1), 10, y);
            pdf.text(`${formatarPeso(pAtual)} kg`, 40, y);
            pdf.text(`R$ ${formatarMoeda(valorInd)}`, 90, y);
            pdf.text(p.obs || "-", 150, y);
            y += 7;
        });

        let pluginsNativos = window.Capacitor ? window.Capacitor.Plugins : null;
        if (!pluginsNativos || !pluginsNativos.Filesystem || !pluginsNativos.Share) {
            alert("Salvando arquivo localmente...");
            pdf.save(nomeArquivoPesagem(r, "pdf"));
            return;
        }

        let pdfOutput = pdf.output('datauristring');
        let base64Data = pdfOutput.split(',')[1];
        let nomeArquivo = nomeArquivoPesagem(r, "pdf");

        const { Filesystem, Share } = pluginsNativos;

        let resultadoSalvar = await Filesystem.writeFile({
            path: nomeArquivo,
            data: base64Data,
            directory: 'CACHE'
        });

        await Share.share({
            title: 'Enviar Relatório',
            text: `Segue em anexo o PDF da pesagem - Vendedor: ${r.vendedor || 'Geral'}`,
            url: resultadoSalvar.uri,
            dialogTitle: 'Enviar pelo WhatsApp:'
        });

    } catch (e) {
        alert("Ocorreu um erro no processamento do PDF: " + e.message);
    }
}

function nomeArquivoPesagem(r, extensao){
    let prefixo = r.numero ? `Pesagem_${r.numero}` : "Pesagem";
    let vendedor = (r.vendedor || "lote").replace(/\s+/g, "_");
    return `${prefixo}_${vendedor}.${extensao}`;
}

function calcularDadosCompletos(r) {
    let stringValor = String(r.valorKg || "0");
    let valorKgNum = parseFloat(stringValor.replace("R$ ", "").replace(/\./g, "").replace(",", ".")) || 0;

    let ehArroba = r.tipoPesagem === "arroba";
    let rendimentoNum = parseFloat(String(r.rendimento || "0").replace(",", ".")) || 0;

    let listaPesos = r.pesos ? r.pesos.map(p => p.peso || 0) : [];
    let pesosOrdenados = [...listaPesos].sort((a, b) => a - b);
    let totalKg = pesosOrdenados.reduce((sum, w) => sum + w, 0);
    let totalAnimais = pesosOrdenados.length;
    let totalArroba = converterParaArroba(totalKg, rendimentoNum);

    return {
        valorKgNum: valorKgNum,
        totalKg: totalKg,
        totalAnimais: totalAnimais,
        mediaKg: totalAnimais ? (totalKg / totalAnimais) : 0,
        totalRS: (ehArroba ? totalArroba : totalKg) * valorKgNum,
        totalArroba: totalArroba,
        ehArroba: ehArroba,
        rendimentoNum: rendimentoNum,
        arrobaDe: pesoKg => converterParaArroba(pesoKg, rendimentoNum),
        leves: pesosOrdenados.slice(0, 3).map(formatarPeso).join(", ") + " kg",
        pesados: pesosOrdenados.slice(-3).reverse().map(formatarPeso).join(", ") + " kg",
        dataHora: r.data || new Date().toLocaleString()
    };
}

// ========================================
// IMPRESSÃO E EXCEL
// ========================================
function prepararImpressao(){
    let sel = document.querySelector("input[name='relatorioSelecionado']:checked");
    if(!sel){ alert("Selecione um relatório"); return; }
    
    let r = relatorios[sel.value];
    let d = calcularDadosCompletos(r);
    
    let html = `
        <h2>Pesagem Estância Reis ${r.numero ? "— Nº " + r.numero : ""}</h2>
        <hr>
        <p><b>Vendedor:</b> ${r.vendedor || "-"} &nbsp;&nbsp;&nbsp;&nbsp; <b>Data:</b> ${d.dataHora}</p>
        <p><b>Descrição:</b> ${r.descricao || "-"} &nbsp;&nbsp;&nbsp;&nbsp; <b>Valor por Kg:</b> R$ ${formatarMoeda(d.valorKgNum)}</p>
        <p><b>Total Animais:</b> ${d.totalAnimais} &nbsp;&nbsp;&nbsp;&nbsp; <b>Média Lote:</b> ${d.mediaKg.toFixed(2).replace(".", ",")} kg</p>
        <p><b>Peso Acumulado:</b> ${formatarPeso(d.totalKg)} kg &nbsp;&nbsp;&nbsp;&nbsp; <b>Faturamento Total:</b> R$ ${formatarMoeda(d.totalRS)}</p>
        ${d.ehArroba ? `<p><b>Total em Arrobas:</b> ${d.totalArroba.toFixed(2).replace(".", ",")} @ (Rendimento ${d.rendimentoNum}%)</p>` : ""}
        <br>
        <table border="1" style="width:100%; border-collapse:collapse; text-align:center;">
            <thead>
                <tr style="background:#eee"><th>Nº</th><th>Peso</th><th>Valor Individual</th><th>Observação</th></tr>
            </thead>
            <tbody>
    `;
    
    r.pesos.forEach((p, i) => {
        let pAtual = p.peso || 0;
        let vInd = (d.ehArroba ? d.arrobaDe(pAtual) : pAtual) * d.valorKgNum;
        html += `<tr><td>${i+1}</td><td>${formatarPeso(pAtual)} kg</td><td>R$ ${formatarMoeda(vInd)}</td><td>${p.obs || "-"}</td></tr>`;
    });
    
    html += `</tbody></table>`;
    
    let folha = document.getElementById("folhaRelatorio");
    if(folha) folha.innerHTML = html;
    trocarTela("telaImpressao");
}

function executarImpressao(){
    let botoes = document.querySelector(".botoes-impressao");
    if(botoes) botoes.style.display = "none";
    setTimeout(() => {
        window.print();
        if(botoes) botoes.style.display = "flex";
    }, 500);
}

function exportarExcel(){
    let sel = document.querySelector("input[name='relatorioSelecionado']:checked");
    if(!sel){ alert("Selecione um relatório"); return; }

    let r = relatorios[sel.value];
    let d = calcularDadosCompletos(r);
    let dataExcel = [];

    r.pesos.forEach((p, i) => {
        let linha = {
            "Ordem": i + 1,
            "Peso (kg)": p.peso || 0
        };
        if(d.ehArroba){
            linha["Arrobas (@)"] = Number(d.arrobaDe(p.peso || 0).toFixed(2));
        }
        linha["Anotação"] = p.obs || "";
        dataExcel.push(linha);
    });
    
    let worksheet = XLSX.utils.json_to_sheet(dataExcel);
    let workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pesagem");
    XLSX.writeFile(workbook, nomeArquivoPesagem(r, "xlsx"));
}

// ========================================
// COMPARTILHAR NO WHATSAPP
// ========================================
function montarMensagemWhatsApp(r, d){
    let valorMedio = d.totalAnimais ? d.totalRS / d.totalAnimais : 0;

    let linhas = [];
    linhas.push("📋 *RELATÓRIO DE PESAGEM*" + (r.numero ? " — Nº " + r.numero : ""));
    linhas.push("");
    linhas.push("*Tipo:* " + ((r.tipo || "venda") === "compra" ? "Compra" : "Venda"));
    linhas.push("*Vendedor:* " + (r.vendedor || "Não informado"));
    linhas.push("*Lote/Descrição:* " + (r.descricao || "Sem descrição"));
    linhas.push("*Data:* " + d.dataHora);
    linhas.push("*Valor:* R$ " + formatarMoeda(d.valorKgNum) + (d.ehArroba ? " por @" : " por kg"));
    linhas.push("");
    linhas.push("*RESUMO*");
    linhas.push("Total de animais: " + d.totalAnimais);
    linhas.push("Peso total: " + formatarPeso(d.totalKg) + " kg");
    linhas.push("Peso médio: " + d.mediaKg.toFixed(2).replace(".", ",") + " kg");
    if(d.ehArroba){
        linhas.push("Total em arrobas: " + d.totalArroba.toFixed(2).replace(".", ",") + " @ (Rend. " + d.rendimentoNum + "%)");
    }
    linhas.push("Valor médio por animal: R$ " + formatarMoeda(valorMedio));
    linhas.push("3 mais pesados: " + d.pesados);
    linhas.push("3 mais leves: " + d.leves);
    linhas.push("*Faturamento total: R$ " + formatarMoeda(d.totalRS) + "*");
    linhas.push("");
    linhas.push("*PESAGENS*");
    (r.pesos || []).forEach((p, i) => {
        let pesoKg = p.peso || 0;
        let valorInd = (d.ehArroba ? d.arrobaDe(pesoKg) : pesoKg) * d.valorKgNum;
        let linha = (i + 1) + " - " + formatarPeso(pesoKg) + "kg";
        if(d.ehArroba){
            linha += " (" + d.arrobaDe(pesoKg).toFixed(2).replace(".", ",") + " @)";
        }
        linha += " - R$ " + formatarMoeda(valorInd);
        if(p.obs) linha += " [" + p.obs + "]";
        linhas.push(linha);
    });
    linhas.push("");
    linhas.push("💰 *Total: R$ " + formatarMoeda(d.totalRS) + "*");
    return linhas.join("\n");
}

function compartilharWhatsApp(){
    let sel = document.querySelector("input[name='relatorioSelecionado']:checked");
    if(!sel){ alert("Selecione um relatório primeiro!"); return; }

    let indiceReal = parseInt(sel.value);
    let r = relatorios[indiceReal];
    if(!r || !r.pesos){ alert("Erro ao ler os dados do relatório selecionado."); return; }

    let d = calcularDadosCompletos(r);
    let mensagem = montarMensagemWhatsApp(r, d);
    window.open("https://wa.me/?text=" + encodeURIComponent(mensagem), "_blank");
}

// ========================================
// BACKUP / RESTAURAÇÃO (JSON)
// ========================================
function exportarBackup(){
    if(relatorios.length === 0){
        alert("Nenhum relatório salvo para fazer backup!");
        return;
    }

    let blob = new Blob([JSON.stringify(relatorios, null, 2)], { type: "application/json" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    let agora = new Date().toISOString().slice(0, 10);

    a.href = url;
    a.download = `backup_pesagem_${agora}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importarBackup(event){
    let arquivo = event.target.files[0];
    if(!arquivo) return;

    let leitor = new FileReader();
    leitor.onload = function(e){
        try {
            let dados = JSON.parse(e.target.result);
            if(!Array.isArray(dados)) throw new Error("Formato inválido");

            if(!confirm(`Este backup tem ${dados.length} relatório(s). Isso vai SUBSTITUIR os relatórios salvos neste aparelho. Continuar?`)) {
                event.target.value = "";
                return;
            }

            relatorios = dados;
            localStorage.setItem("pesagens", JSON.stringify(relatorios));
            mostrarRelatorios();
            alert("Backup restaurado com sucesso!");
        } catch(err) {
            alert("Arquivo de backup inválido ou corrompido.");
        } finally {
            event.target.value = "";
        }
    };
    leitor.readAsText(arquivo);
}

function excluirSelecionado(){
    let sel = document.querySelector("input[name='relatorioSelecionado']:checked");
    if(!sel){ alert("Selecione um relatório"); return; }
    if(!confirm("Deseja excluir este relatório permanentemente?")) return;

    let removido = relatorios[sel.value];
    relatorios.splice(sel.value, 1);
    localStorage.setItem("pesagens", JSON.stringify(relatorios));

    if(removido && removido.id && typeof registrarExclusaoPendente === "function"){
        registrarExclusaoPendente(removido.id);
    }

    mostrarRelatorios();
}

// ========================================
// SLIDER CANCELAR / FINALIZAR
// ========================================
function avaliarArraste(deltaX, maxOffset, limiar){
    if(maxOffset <= 0) return null;
    let proporcao = deltaX / maxOffset;
    if(proporcao <= -limiar) return "cancelar";
    if(proporcao >= limiar) return "finalizar";
    return null;
}

function inicializarSliderFinalizar(){
    let track = document.getElementById("sliderTrack");
    let handle = document.getElementById("sliderHandle");
    if(!track || !handle) return;

    const LIMIAR = 0.7;
    let arrastando = false;
    let startX = 0;
    let deltaX = 0;
    let maxOffset = 0;

    function corDoArraste(){
        let proporcao = maxOffset > 0 ? deltaX / maxOffset : 0;
        if(proporcao <= -0.2){
            handle.style.background = "#e53935";
            handle.style.color = "#fff";
            handle.innerText = "✕";
        } else if(proporcao >= 0.2){
            handle.style.background = "#2e7d32";
            handle.style.color = "#fff";
            handle.innerText = "✓";
        } else {
            handle.style.background = "#ffffff";
            handle.style.color = "#555";
            handle.innerText = "↔";
        }
    }

    function inicio(clientX, pointerId){
        arrastando = true;
        startX = clientX;
        deltaX = 0;
        maxOffset = (track.offsetWidth - handle.offsetWidth) / 2 - 4;
        handle.style.transition = "none";
        if(track.setPointerCapture && pointerId !== undefined){
            try { track.setPointerCapture(pointerId); } catch(e){}
        }
    }

    function mover(clientX){
        if(!arrastando) return;
        let bruto = clientX - startX;
        deltaX = Math.max(-maxOffset, Math.min(maxOffset, bruto));
        handle.style.transform = `translateX(calc(-50% + ${deltaX}px))`;
        corDoArraste();
    }

    function fim(){
        if(!arrastando) return;
        arrastando = false;
        handle.style.transition = "transform 0.25s ease";
        handle.style.transform = "translateX(-50%)";
        handle.style.background = "#ffffff";
        handle.style.color = "#555";
        handle.innerText = "↔";

        let resultado = avaliarArraste(deltaX, maxOffset, LIMIAR);
        deltaX = 0;

        if(resultado === "cancelar"){
            solicitarCancelarPesagem();
        } else if(resultado === "finalizar"){
            solicitarFinalizarPesagem();
        }
    }

    track.addEventListener("pointerdown", e => inicio(e.clientX, e.pointerId));
    track.addEventListener("pointermove", e => mover(e.clientX));
    track.addEventListener("pointerup", fim);
    track.addEventListener("pointercancel", fim);
}

// ========================================
// SINCRONIZAÇÃO COM SERVIDOR (ONLINE/OFFLINE)
// ========================================
const API_URL = "https://pesocerto-api-production.up.railway.app";

function obterToken(){
    return localStorage.getItem("sessionToken") || "";
}

function obterUsuarioLogado(){
    return localStorage.getItem("usuarioNome") || "";
}

function obterPapelLogado(){
    return localStorage.getItem("usuarioPapel") || "";
}

function obterPermTipoPesagem(){
    return localStorage.getItem("permTipoPesagem") || "ambos";
}

function obterPermDashboard(){
    return localStorage.getItem("permDashboard") || "geral";
}

function obterPermRelatorios(){
    return localStorage.getItem("permRelatorios") || "geral";
}

function obterValorMaximoCompra(){
    let v = localStorage.getItem("valorMaximoCompra");
    if(v === null || v === "") return null;
    let n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
}

function obterPermAlmoxarifado(){
    return localStorage.getItem("permAlmoxarifado") === "1";
}

function obterPermVacasMatriz(){
    return localStorage.getItem("permVacasMatriz") === "1";
}

function aplicarRestricoesUsuario(){
    let selectTipo = document.getElementById("tipoOperacao");
    if(!selectTipo) return;

    Array.from(selectTipo.options).forEach(o => { o.disabled = false; });

    let permTipo = obterPermTipoPesagem();
    if(obterPapelLogado() !== "admin" && permTipo !== "ambos"){
        Array.from(selectTipo.options).forEach(o => {
            if(o.value !== permTipo) o.disabled = true;
        });
        selectTipo.value = permTipo;
    }
}

function mostrarTelaLogin(){
    let erroEl = document.getElementById("loginErro");
    if(erroEl){ erroEl.style.display = "none"; erroEl.innerText = ""; }
    let campoUsuario = document.getElementById("loginUsuario");
    let campoSenha = document.getElementById("loginSenha");
    if(campoUsuario) campoUsuario.value = "";
    if(campoSenha) campoSenha.value = "";
    trocarTela("telaLogin");
    if(campoUsuario) campoUsuario.focus();
}

function limparDadosVisiveis(){
    let listaRel = document.getElementById("listaRelatorios");
    if(listaRel) listaRel.innerHTML = "";
    let corpoUsuarios = document.getElementById("corpoTabelaUsuarios");
    if(corpoUsuarios) corpoUsuarios.innerHTML = "";
    let corpoLotes = document.getElementById("corpoTabelaLotes");
    if(corpoLotes) corpoLotes.innerHTML = "";
    ["dashAtivos", "dashComprados", "dashVendidos", "dashKgCompra", "dashKgVenda",
     "dashValorCompra", "dashValorVenda", "dashSaldo", "dashKgTotal", "dashAnimaisTotal"].forEach(id => {
        let el = document.getElementById(id);
        if(el) el.innerText = "0";
    });
}

function irParaTelaPrincipal(){
    if(document.getElementById("telaMenu")){
        trocarTela("telaMenu");
    } else if(document.getElementById("telaDashboard")){
        abrirDashboard();
    }
}

async function enviarLogin(){
    let usuario = document.getElementById("loginUsuario").value.trim();
    let senha = document.getElementById("loginSenha").value;
    let erroEl = document.getElementById("loginErro");

    function mostrarErro(msg){
        if(erroEl){ erroEl.innerText = msg; erroEl.style.display = "block"; }
    }

    if(!usuario || !senha){
        mostrarErro("Preencha usuário e senha.");
        return;
    }

    try {
        let resp = await fetch(`${API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario, senha })
        });
        let dados = await resp.json();
        if(!resp.ok){
            mostrarErro(dados.erro || "Não foi possível entrar.");
            return;
        }
        localStorage.setItem("sessionToken", dados.token);
        localStorage.setItem("usuarioNome", dados.nome);
        localStorage.setItem("usuarioPapel", dados.papel);
        localStorage.setItem("permTipoPesagem", dados.permissaoTipoPesagem || "ambos");
        localStorage.setItem("permDashboard", dados.permissaoDashboard || "geral");
        localStorage.setItem("permRelatorios", dados.permissaoRelatorios || "geral");
        localStorage.setItem("valorMaximoCompra", dados.valorMaximoCompra != null ? String(dados.valorMaximoCompra) : "");
        localStorage.setItem("permAlmoxarifado", dados.permissaoAlmoxarifado ? "1" : "");
        localStorage.setItem("permVacasMatriz", dados.permissaoVacasMatriz ? "1" : "");
        irParaTelaPrincipal();
        atualizarBotaoLogin();
        aplicarRestricoesUsuario();
        sincronizarAgora();
    } catch(e) {
        mostrarErro("Erro de conexão.");
    }
}

function sair(){
    let token = obterToken();
    if(token){
        fetch(`${API_URL}/api/auth/logout`, {
            method: "POST",
            headers: { "Authorization": "Bearer " + token }
        }).catch(() => {});
    }
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("usuarioNome");
    localStorage.removeItem("usuarioPapel");
    localStorage.removeItem("permTipoPesagem");
    localStorage.removeItem("permDashboard");
    localStorage.removeItem("permRelatorios");
    localStorage.removeItem("valorMaximoCompra");
    localStorage.removeItem("permAlmoxarifado");
    localStorage.removeItem("permVacasMatriz");
    localStorage.removeItem("produtosCache");
    localStorage.removeItem("pastosCache");
    limparDadosVisiveis();
    atualizarBotaoLogin();
    aplicarRestricoesUsuario();
    atualizarStatusSync("👤 Não conectado");
    mostrarTelaLogin();
}

function atualizarBotaoLogin(){
    let logado = !!obterToken();

    let btn = document.getElementById("btnLoginLogout");
    if(btn){
        let nome = obterUsuarioLogado();
        if(nome){
            btn.innerText = "🚪 Sair (" + nome + ")";
            btn.onclick = sair;
        } else {
            btn.innerText = "👤 Entrar";
            btn.onclick = mostrarTelaLogin;
        }
    }

    // Nav do gerenciamento (desktop): cada botão só aparece se o usuário
    // estiver logado, e Usuários/Lotes exigem também o papel admin.
    [
        { id: "telaDashboard", soAdmin: false },
        { id: "telaResultado", soAdmin: false },
        { id: "telaUsuarios", soAdmin: true },
        { id: "telaLotes", soAdmin: true },
        { id: "telaAlmoxarifado", soAdmin: true },
        { id: "telaFluxoCaixa", soAdmin: true },
        { id: "telaContasPagar", soAdmin: true },
        { id: "telaVacasMatriz", soAdmin: true }
    ].forEach(({ id, soAdmin }) => {
        let navBtn = document.querySelector(`[data-tela="${id}"]`);
        if(!navBtn) return;
        let podeVer = logado && (!soAdmin || obterPapelLogado() === "admin");
        navBtn.style.display = podeVer ? "inline-block" : "none";
    });

    // Botão de Saída de Almoxarifado no menu do celular: só aparece pra admin
    // ou pra quem o admin autorizou especificamente (permissaoAlmoxarifado).
    let btnAlmoxMenu = document.getElementById("btnMenuAlmoxarifado");
    if(btnAlmoxMenu){
        let podeAlmoxarifado = logado && (obterPapelLogado() === "admin" || obterPermAlmoxarifado());
        btnAlmoxMenu.style.display = podeAlmoxarifado ? "inline-block" : "none";
    }

    // Botão de Vacas Matriz no menu do celular: mesma lógica — admin ou
    // quem o admin autorizou especificamente (permissaoVacasMatriz).
    let btnVacasMenu = document.getElementById("btnMenuVacasMatriz");
    if(btnVacasMenu){
        let podeVacasMatriz = logado && (obterPapelLogado() === "admin" || obterPermVacasMatriz());
        btnVacasMenu.style.display = podeVacasMatriz ? "inline-block" : "none";
    }
}

function carregarLotesSelect(){
    let select = document.getElementById("descricao");
    if(!select) return;
    let lotes = JSON.parse(localStorage.getItem("lotesCache") || "[]");
    let valorAtual = select.value;
    select.innerHTML = `<option value="">Sem lote</option>` +
        lotes.map(l => `<option value="${l.nome.replace(/"/g, "&quot;")}">${l.nome}</option>`).join("");
    select.value = valorAtual;
}

function carregarLotesSelectSaida(){
    let select = document.getElementById("saidaMobLoteInput");
    if(!select) return;
    let lotes = JSON.parse(localStorage.getItem("lotesCache") || "[]");
    let valorAtual = select.value;
    select.innerHTML = `<option value="">Selecione o lote</option>` +
        lotes.map(l => `<option value="${l.nome.replace(/"/g, "&quot;")}">${l.nome}</option>`).join("");
    select.value = valorAtual;
}

function carregarProdutosSelectMobile(){
    let select = document.getElementById("saidaMobProdutoInput");
    if(!select) return;
    let produtos = JSON.parse(localStorage.getItem("produtosCache") || "[]");
    let valorAtual = select.value;
    select.innerHTML = `<option value="">Selecione o produto</option>` +
        produtos.map(p => `<option value="${p.id}">${p.descricao}</option>`).join("");
    select.value = valorAtual;
    atualizarPreviewSaidaMobile();
}

function obterProdutoCache(id){
    let produtos = JSON.parse(localStorage.getItem("produtosCache") || "[]");
    return produtos.find(p => p.id === id) || null;
}

function atualizarPreviewSaidaMobile(){
    let preview = document.getElementById("saidaMobPreview");
    if(!preview) return;
    let produtoId = document.getElementById("saidaMobProdutoInput").value;
    let qtd = parseFloat((document.getElementById("saidaMobQuantidadeInput").value || "").replace(",", ".")) || 0;
    let produto = obterProdutoCache(produtoId);
    if(!produto){ preview.innerText = ""; return; }

    let texto = "Estoque disponível: " + formatarPeso(produto.saldoAtual) + " " + produto.unidade +
        " · Custo médio: R$ " + formatarMoeda(produto.custoMedioUnitario);
    if(qtd > 0) texto += " · Total estimado: R$ " + formatarMoeda(qtd * produto.custoMedioUnitario);
    preview.innerText = texto;
}

function abrirTelaSaidaAlmoxarifadoMobile(){
    carregarLotesSelectSaida();
    carregarProdutosSelectMobile();
    document.getElementById("saidaMobQuantidadeInput").value = "";
    let erroEl = document.getElementById("saidaMobErro");
    if(erroEl){ erroEl.style.display = "none"; erroEl.innerText = ""; }
    atualizarPreviewSaidaMobile();
}

async function confirmarSaidaEstoqueMobile(){
    let erroEl = document.getElementById("saidaMobErro");
    function mostrarErro(msg){ if(erroEl){ erroEl.innerText = msg; erroEl.style.display = "block"; } }

    let loteNome = document.getElementById("saidaMobLoteInput").value;
    let produtoId = document.getElementById("saidaMobProdutoInput").value;
    let quantidade = parseFloat((document.getElementById("saidaMobQuantidadeInput").value || "").replace(",", "."));

    if(!loteNome){ mostrarErro("Selecione o lote."); return; }
    if(!produtoId){ mostrarErro("Selecione o produto."); return; }
    if(!Number.isFinite(quantidade) || quantidade <= 0){ mostrarErro("Quantidade inválida."); return; }

    let produto = obterProdutoCache(produtoId);
    if(produto && quantidade > produto.saldoAtual){
        mostrarErro("Estoque insuficiente (disponível: " + formatarPeso(produto.saldoAtual) + " " + produto.unidade + ").");
        return;
    }

    let lista = JSON.parse(localStorage.getItem("estoqueSaidas") || "[]");
    lista.push({
        id: crypto.randomUUID(),
        produtoId: produtoId,
        loteNome: loteNome,
        quantidade: quantidade,
        data: new Date().toLocaleString("pt-BR"),
        sincronizado: false
    });
    localStorage.setItem("estoqueSaidas", JSON.stringify(lista));

    alert("Saída registrada! Assim que sincronizar, o estoque é atualizado.");
    document.getElementById("saidaMobQuantidadeInput").value = "";
    if(erroEl){ erroEl.style.display = "none"; erroEl.innerText = ""; }
    sincronizarAgora();
}

// ========================================
// LEITOR DE CÓDIGO DE BARRAS (câmera)
// ========================================
let leitorZXing = null;

async function abrirLeitorCodigoBarra(){
    let statusEl = document.getElementById("leitorCodigoBarraStatus");
    if(typeof ZXingBrowser === "undefined"){
        alert("Leitor de código de barras não carregou. Selecione o produto manualmente.");
        return;
    }
    let modal = document.getElementById("modalLeitorCodigoBarra");
    if(!modal) return;
    modal.style.display = "flex";
    if(statusEl) statusEl.innerText = "Aponte a câmera pro código de barras do produto";

    try {
        leitorZXing = new ZXingBrowser.BrowserMultiFormatReader();
        let dispositivos = await ZXingBrowser.BrowserCodeReader.listVideoInputDevices();
        // prefere a câmera traseira quando o navegador identifica isso no label
        let traseira = dispositivos.find(d => /back|traseira|rear|environment/i.test(d.label)) || dispositivos[dispositivos.length - 1];
        let deviceId = traseira ? traseira.deviceId : undefined;

        await leitorZXing.decodeFromVideoDevice(deviceId, "videoLeitorCodigoBarra", (resultado) => {
            if(resultado){
                processarCodigoBarraLido(resultado.getText());
            }
        });
    } catch(e){
        if(statusEl) statusEl.innerText = "Não foi possível acessar a câmera. Selecione o produto manualmente.";
    }
}

function fecharLeitorCodigoBarra(){
    let modal = document.getElementById("modalLeitorCodigoBarra");
    if(modal) modal.style.display = "none";
    if(leitorZXing){
        try { leitorZXing.reset(); } catch(e){}
        leitorZXing = null;
    }
}

function processarCodigoBarraLido(codigo){
    let produtos = JSON.parse(localStorage.getItem("produtosCache") || "[]");
    let produto = produtos.find(p => p.codigoBarra === codigo);
    fecharLeitorCodigoBarra();
    if(!produto){
        alert("Nenhum produto cadastrado com esse código de barra. Cadastre no computador primeiro, ou selecione manualmente.");
        return;
    }
    document.getElementById("saidaMobProdutoInput").value = produto.id;
    atualizarPreviewSaidaMobile();
}

function registrarExclusaoPendente(id){
    let lista = JSON.parse(localStorage.getItem("exclusoesPendentes") || "[]");
    if(!lista.includes(id)) lista.push(id);
    localStorage.setItem("exclusoesPendentes", JSON.stringify(lista));
}

function atualizarStatusSync(texto){
    let el = document.getElementById("statusSync");
    if(el) el.innerText = texto;
}

async function sincronizarAgora(){
    let token = obterToken();
    if(!token){
        atualizarStatusSync("⚠️ Toque em Entrar pra ativar a sincronização");
        return;
    }
    if(!navigator.onLine){
        atualizarStatusSync("📴 Offline — sincroniza quando voltar internet");
        return;
    }

    // Trabalha do início ao fim com uma cópia LOCAL lida direto do localStorage,
    // nunca com a variável global "relatorios" — ela pode ser reatribuída por
    // outro código (ex: finalizarPesagem) enquanto este await está pendente,
    // e usar a global no meio da função perde mutações feitas aqui.
    let lista = JSON.parse(localStorage.getItem("pesagens") || "[]");
    let precisaSalvarIds = false;
    lista.forEach(r => {
        if(!r.id){
            r.id = crypto.randomUUID();
            r.sincronizado = false;
            precisaSalvarIds = true;
        }
    });
    if(precisaSalvarIds) localStorage.setItem("pesagens", JSON.stringify(lista));

    atualizarStatusSync("🔄 Sincronizando...");

    try {
        let sessaoExpirada = false;

        let naoSincronizados = lista.filter(r => !r.sincronizado);
        let idsRejeitadosPermissao = [];
        if(naoSincronizados.length > 0){
            let resp = await fetch(`${API_URL}/api/pesagens/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify({ pesagens: naoSincronizados })
            });
            if(resp.status === 401) sessaoExpirada = true;
            if(!resp.ok) throw new Error(sessaoExpirada ? "sessão expirada, faça login de novo" : "falha ao enviar");
            let respostaSync = await resp.json().catch(() => ({}));
            idsRejeitadosPermissao = respostaSync.idsRejeitados || [];
            // só marca como sincronizado o que o servidor realmente aceitou —
            // um HTTP 200 não significa que TODOS os registros do lote foram
            // gravados, já que o servidor descarta silenciosamente pesagens
            // de um tipo que o usuário não tem permissão de lançar
            naoSincronizados.forEach(r => {
                if(!idsRejeitadosPermissao.includes(r.id)) r.sincronizado = true;
            });
            localStorage.setItem("pesagens", JSON.stringify(lista));
        }

        let exclusoesPendentes = JSON.parse(localStorage.getItem("exclusoesPendentes") || "[]");
        for(let id of [...exclusoesPendentes]){
            let respDel = await fetch(`${API_URL}/api/pesagens/${id}`, {
                method: "DELETE",
                headers: { "Authorization": "Bearer " + token }
            });
            if(respDel.ok){
                exclusoesPendentes = exclusoesPendentes.filter(x => x !== id);
            }
        }
        localStorage.setItem("exclusoesPendentes", JSON.stringify(exclusoesPendentes));

        let respGet = await fetch(`${API_URL}/api/pesagens`, {
            headers: { "Authorization": "Bearer " + token }
        });
        if(respGet.status === 401) sessaoExpirada = true;
        if(!respGet.ok) throw new Error(sessaoExpirada ? "sessão expirada, faça login de novo" : "falha ao buscar dados");
        let doServidor = await respGet.json();

        let respLotes = await fetch(`${API_URL}/api/lotes`, {
            headers: { "Authorization": "Bearer " + token }
        });
        if(respLotes.ok){
            let lotesDoServidor = await respLotes.json();
            localStorage.setItem("lotesCache", JSON.stringify(lotesDoServidor.filter(l => l.ativo)));
            carregarLotesSelect();
            carregarLotesSelectSaida();
        }

        // Almoxarifado: só sincroniza pra quem tem acesso (admin ou permissão
        // concedida), evitando requisições à toa pra todo mundo mais.
        let idsRejeitadosSaidas = [];
        if(obterPapelLogado() === "admin" || obterPermAlmoxarifado()){
            let listaSaidas = JSON.parse(localStorage.getItem("estoqueSaidas") || "[]");
            let precisaSalvarSaidas = false;
            listaSaidas.forEach(s => {
                if(!s.id){ s.id = crypto.randomUUID(); s.sincronizado = false; precisaSalvarSaidas = true; }
            });
            if(precisaSalvarSaidas) localStorage.setItem("estoqueSaidas", JSON.stringify(listaSaidas));

            let naoSincronizadasSaidas = listaSaidas.filter(s => !s.sincronizado);
            if(naoSincronizadasSaidas.length > 0){
                let respSaida = await fetch(`${API_URL}/api/estoque-saidas/sync`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                    body: JSON.stringify({ saidas: naoSincronizadasSaidas })
                });
                if(respSaida.ok){
                    let respostaSaida = await respSaida.json().catch(() => ({}));
                    idsRejeitadosSaidas = respostaSaida.idsRejeitados || [];
                    naoSincronizadasSaidas.forEach(s => {
                        if(!idsRejeitadosSaidas.includes(s.id)) s.sincronizado = true;
                    });
                    localStorage.setItem("estoqueSaidas", JSON.stringify(listaSaidas));
                }
            }

            let respProdutos = await fetch(`${API_URL}/api/produtos`, {
                headers: { "Authorization": "Bearer " + token }
            });
            if(respProdutos.ok){
                let produtosDoServidor = await respProdutos.json();
                localStorage.setItem("produtosCache", JSON.stringify(produtosDoServidor.filter(p => p.ativo)));
                carregarProdutosSelectMobile();
            }
        }

        // Vacas Matriz: mesmo raciocínio do Almoxarifado — só sincroniza pra
        // quem tem acesso, e os dois tipos de registro (vacas e nascimentos)
        // usam o MESMO endpoint /sync tanto pra criar quanto pra atualizar
        // status (morte, apartação), então basta reenviar o que mudou.
        let idsRejeitadosVacas = [];
        let idsRejeitadosNascimentos = [];
        if(obterPapelLogado() === "admin" || obterPermVacasMatriz()){
            let listaVacas = JSON.parse(localStorage.getItem("vacasMatriz") || "[]");
            let naoSincronizadasVacas = listaVacas.filter(v => !v.sincronizado);
            if(naoSincronizadasVacas.length > 0){
                let respVacas = await fetch(`${API_URL}/api/vacas-matriz/sync`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                    body: JSON.stringify({ vacas: naoSincronizadasVacas })
                });
                if(respVacas.ok){
                    let respostaVacas = await respVacas.json().catch(() => ({}));
                    idsRejeitadosVacas = respostaVacas.idsRejeitados || [];
                    naoSincronizadasVacas.forEach(v => {
                        if(!idsRejeitadosVacas.includes(v.id)) v.sincronizado = true;
                    });
                    localStorage.setItem("vacasMatriz", JSON.stringify(listaVacas));
                }
            }

            let listaNascimentos = JSON.parse(localStorage.getItem("nascimentos") || "[]");
            let naoSincronizadosNascimentos = listaNascimentos.filter(n => !n.sincronizado);
            if(naoSincronizadosNascimentos.length > 0){
                let respNasc = await fetch(`${API_URL}/api/nascimentos/sync`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                    body: JSON.stringify({ nascimentos: naoSincronizadosNascimentos })
                });
                if(respNasc.ok){
                    let respostaNasc = await respNasc.json().catch(() => ({}));
                    idsRejeitadosNascimentos = respostaNasc.idsRejeitados || [];
                    naoSincronizadosNascimentos.forEach(n => {
                        if(!idsRejeitadosNascimentos.includes(n.id)) n.sincronizado = true;
                    });
                    localStorage.setItem("nascimentos", JSON.stringify(listaNascimentos));
                }
            }

            let respPastos = await fetch(`${API_URL}/api/pastos`, { headers: { "Authorization": "Bearer " + token } });
            if(respPastos.ok){
                let pastosDoServidor = await respPastos.json();
                localStorage.setItem("pastosCache", JSON.stringify(pastosDoServidor.filter(p => p.ativo)));
            }
            let respVacasGet = await fetch(`${API_URL}/api/vacas-matriz`, { headers: { "Authorization": "Bearer " + token } });
            if(respVacasGet.ok){
                let vacasDoServidor = await respVacasGet.json();
                let mapaVacas = {};
                vacasDoServidor.forEach(v => { mapaVacas[v.id] = Object.assign({}, v, { sincronizado: true }); });
                listaVacas.forEach(v => { if(!v.sincronizado && v.id) mapaVacas[v.id] = v; });
                localStorage.setItem("vacasMatriz", JSON.stringify(Object.values(mapaVacas)));
            }
            let respNascGet = await fetch(`${API_URL}/api/nascimentos`, { headers: { "Authorization": "Bearer " + token } });
            if(respNascGet.ok){
                let nascimentosDoServidor = await respNascGet.json();
                let mapaNasc = {};
                nascimentosDoServidor.forEach(n => { mapaNasc[n.id] = Object.assign({}, n, { sincronizado: true }); });
                listaNascimentos.forEach(n => { if(!n.sincronizado && n.id) mapaNasc[n.id] = n; });
                localStorage.setItem("nascimentos", JSON.stringify(Object.values(mapaNasc)));
            }
            if(typeof mostrarVacasMatrizMobile === "function") mostrarVacasMatrizMobile();
        }

        let mapa = {};
        doServidor.forEach(r => { mapa[r.id] = Object.assign({}, r, { sincronizado: true }); });
        lista.forEach(r => {
            if(!r.sincronizado && r.id && !exclusoesPendentes.includes(r.id)){
                mapa[r.id] = r;
            }
        });
        exclusoesPendentes.forEach(id => { delete mapa[id]; });

        relatorios = Object.values(mapa);
        localStorage.setItem("pesagens", JSON.stringify(relatorios));

        let telaResultado = document.getElementById("telaResultado");
        if(telaResultado && telaResultado.classList.contains("ativa")){
            mostrarRelatorios();
        }
        let telaDashboard = document.getElementById("telaDashboard");
        if(telaDashboard && telaDashboard.classList.contains("ativa")){
            preencherFiltrosDashboard();
            mostrarDashboard();
            if(typeof mostrarPatrimonio === "function") mostrarPatrimonio();
            if(typeof mostrarEvolucaoPatrimonio === "function") mostrarEvolucaoPatrimonio();
            if(typeof mostrarResultadoMensal === "function") mostrarResultadoMensal();
            if(typeof mostrarCustoPorLote === "function") mostrarCustoPorLote();
        }

        if(idsRejeitadosPermissao.length > 0 || idsRejeitadosSaidas.length > 0 || idsRejeitadosVacas.length > 0 || idsRejeitadosNascimentos.length > 0){
            let partes = [];
            if(idsRejeitadosPermissao.length > 0) partes.push(idsRejeitadosPermissao.length + " pesagem(ns)");
            if(idsRejeitadosSaidas.length > 0) partes.push(idsRejeitadosSaidas.length + " saída(s) de estoque");
            if(idsRejeitadosVacas.length > 0) partes.push(idsRejeitadosVacas.length + " vaca(s)");
            if(idsRejeitadosNascimentos.length > 0) partes.push(idsRejeitadosNascimentos.length + " nascimento(s)");
            atualizarStatusSync("⚠️ " + partes.join(", ") + " não sincronizada(s): confira os dados obrigatórios");
        } else {
            atualizarStatusSync("✅ Sincronizado às " + new Date().toLocaleTimeString("pt-BR"));
        }
    } catch(e) {
        if(e.message.includes("sessão expirada")){
            localStorage.removeItem("sessionToken");
            localStorage.removeItem("usuarioNome");
            localStorage.removeItem("usuarioPapel");
            atualizarBotaoLogin();
        }
        atualizarStatusSync("❌ Erro ao sincronizar (" + e.message + ")");
    }
}

window.addEventListener("online", () => sincronizarAgora());

// ========================================
// INICIALIZAÇÃO ÚNICA (ONLOAD)
// ========================================
function bloquearZoomPinca(){
    // A tag de viewport (user-scalable=no) sozinha não é mais suficiente —
    // navegadores modernos (Chrome principalmente) ignoram essa restrição
    // por acessibilidade. Bloqueando também via JS: gesturestart/gesturechange
    // (gesto de pinça do Safari/iOS) e touchmove com mais de um dedo (Android
    // e demais navegadores).
    document.addEventListener("gesturestart", e => e.preventDefault());
    document.addEventListener("gesturechange", e => e.preventDefault());
    document.addEventListener("touchmove", e => {
        if(e.touches.length > 1) e.preventDefault();
    }, { passive: false });
}

window.onload = function() {
    if(document.getElementById("telaMenu")){
        bloquearZoomPinca();
    }
    relatorios = JSON.parse(localStorage.getItem("pesagens") || "[]");
    carregarLotesSelect();
    carregarLotesSelectSaida();
    carregarProdutosSelectMobile();
    if(typeof restaurarPesagem === "function") {
        restaurarPesagem();
    }
    inicializarSliderFinalizar();
    atualizarBotaoLogin();
    aplicarRestricoesUsuario();

    if(obterToken()){
        irParaTelaPrincipal();
    } else {
        mostrarTelaLogin();
    }
    sincronizarAgora();
};

// ========================================
// TECLADO NUMÉRICO
// ========================================

function digitar(numero){
    let display = document.getElementById("displayPeso");

    if(!display) return;

    display.value += numero;
}

function digitarMeio(){
    let display = document.getElementById("displayPeso");

    if(!display) return;
    if(display.value === "" || display.value.includes(",")) return;

    display.value += ",5";
}

function apagar(){
    let display = document.getElementById("displayPeso");

    if(!display) return;

    if(display.value.endsWith(",5")){
        display.value = display.value.slice(0, -2);
    } else {
        display.value = display.value.slice(0, -1);
    }
}

function lancarPeso(){
    adicionarPeso();
}

// ========================================
// EXCLUSÃO DE ITEM DA PESAGEM
// ========================================

function confirmarExclusaoPeso(){
    fecharConfirmacao(true);
}

// ========================================
// VACAS MATRIZ (celular do vaqueiro)
// ========================================
// Mesmo padrão offline-first já usado em pesagens/estoqueSaidas: guarda
// local com sincronizado:false, sincronizarAgora() manda em lote quando
// pega rede. Criar E atualizar (morte, apartação) usam o mesmo array —
// "editar" aqui é só mudar o campo local e marcar sincronizado:false de
// novo, o servidor faz upsert por id.
// tela hub — nada pra carregar na hora (os dados já vêm do sync), só existe
// pra manter o mesmo padrão "trocarTela(...); abrirTela...();" usado em
// todo o resto do app.
function abrirTelaVacasMatrizMobile(){}

function obterPastosCacheMobile(){
    return JSON.parse(localStorage.getItem("pastosCache") || "[]");
}
function obterVacasMatrizCacheMobile(){
    return JSON.parse(localStorage.getItem("vacasMatriz") || "[]");
}
function obterNascimentosCacheMobile(){
    return JSON.parse(localStorage.getItem("nascimentos") || "[]");
}

function preencherSelectPastoMobile(select){
    if(!select) return;
    let pastos = obterPastosCacheMobile();
    select.innerHTML = `<option value="">Sem pasto definido</option>` +
        pastos.map(p => `<option value="${p.nome.replace(/"/g, "&quot;")}">${p.nome}</option>`).join("");
}

function abrirTelaNovoNascimentoMobile(){
    let selectVaca = document.getElementById("nascMobVacaMaeInput");
    let vacasAtivas = obterVacasMatrizCacheMobile().filter(v => v.status === "ativa");
    selectVaca.innerHTML = `<option value="">Selecione a vaca mãe</option>` +
        vacasAtivas.map(v => `<option value="${v.numero.replace(/"/g, "&quot;")}">${v.numero}${v.apelido ? " — " + v.apelido : ""}</option>`).join("");
    preencherSelectPastoMobile(document.getElementById("nascMobPastoInput"));
    document.getElementById("nascMobNumeroBezerroInput").value = "";
    document.getElementById("nascMobSexoInput").value = "";
    document.getElementById("nascMobPesoInput").value = "";
    let erroEl = document.getElementById("nascMobErro");
    if(erroEl){ erroEl.style.display = "none"; erroEl.innerText = ""; }
}

function confirmarNovoNascimentoMobile(){
    let erroEl = document.getElementById("nascMobErro");
    function mostrarErro(msg){ if(erroEl){ erroEl.innerText = msg; erroEl.style.display = "block"; } }

    let vacaMaeNumero = document.getElementById("nascMobVacaMaeInput").value;
    let numeroBezerro = document.getElementById("nascMobNumeroBezerroInput").value.trim();
    if(!vacaMaeNumero){ mostrarErro("Selecione a vaca mãe."); return; }
    if(!numeroBezerro){ mostrarErro("Informe o número do bezerro."); return; }

    let pesoTexto = document.getElementById("nascMobPesoInput").value.trim();
    let pesoNum = pesoTexto ? parseFloat(pesoTexto.replace(",", ".")) : null;

    let lista = JSON.parse(localStorage.getItem("nascimentos") || "[]");
    lista.push({
        id: crypto.randomUUID(),
        numeroBezerro,
        vacaMaeNumero,
        sexo: document.getElementById("nascMobSexoInput").value || null,
        pesoNascimento: Number.isFinite(pesoNum) ? pesoNum : null,
        dataNascimento: new Date().toLocaleString("pt-BR"),
        pastoNome: document.getElementById("nascMobPastoInput").value || null,
        status: "vivo",
        sincronizado: false
    });
    localStorage.setItem("nascimentos", JSON.stringify(lista));

    alert("Nascimento registrado! Assim que sincronizar, vai pro sistema.");
    trocarTela("telaVacasMatrizMobile");
    sincronizarAgora();
}

function abrirTelaApartacaoMobile(){
    let select = document.getElementById("apartacaoMobBezerroInput");
    let vivos = obterNascimentosCacheMobile().filter(n => n.status === "vivo");
    select.innerHTML = `<option value="">Selecione o bezerro</option>` +
        vivos.map(n => `<option value="${n.id}">${n.numeroBezerro} (mãe ${n.vacaMaeNumero})</option>`).join("");
    document.getElementById("apartacaoMobPesoInput").value = "";
    let erroEl = document.getElementById("apartacaoMobErro");
    if(erroEl){ erroEl.style.display = "none"; erroEl.innerText = ""; }
}

function confirmarApartacaoMobile(){
    let erroEl = document.getElementById("apartacaoMobErro");
    function mostrarErro(msg){ if(erroEl){ erroEl.innerText = msg; erroEl.style.display = "block"; } }

    let nascimentoId = document.getElementById("apartacaoMobBezerroInput").value;
    if(!nascimentoId){ mostrarErro("Selecione o bezerro."); return; }

    let pesoTexto = document.getElementById("apartacaoMobPesoInput").value.trim();
    let pesoNum = pesoTexto ? parseFloat(pesoTexto.replace(",", ".")) : null;

    let lista = JSON.parse(localStorage.getItem("nascimentos") || "[]");
    let nascimento = lista.find(n => n.id === nascimentoId);
    if(!nascimento){ mostrarErro("Bezerro não encontrado — sincronize e tente de novo."); return; }

    nascimento.status = "apartado";
    nascimento.dataApartacao = new Date().toLocaleString("pt-BR");
    nascimento.pesoApartacao = Number.isFinite(pesoNum) ? pesoNum : null;
    nascimento.sincronizado = false;
    localStorage.setItem("nascimentos", JSON.stringify(lista));

    alert("Apartação registrada!");
    trocarTela("telaVacasMatrizMobile");
    sincronizarAgora();
}

function atualizarSelectAnimalMorteMobile(){
    let tipo = document.getElementById("morteMobTipoInput").value;
    let select = document.getElementById("morteMobAnimalInput");
    if(tipo === "vaca"){
        let vacasAtivas = obterVacasMatrizCacheMobile().filter(v => v.status === "ativa");
        select.innerHTML = `<option value="">Selecione a vaca</option>` +
            vacasAtivas.map(v => `<option value="${v.id}">${v.numero}${v.apelido ? " — " + v.apelido : ""}</option>`).join("");
    } else {
        let vivos = obterNascimentosCacheMobile().filter(n => n.status === "vivo");
        select.innerHTML = `<option value="">Selecione o bezerro</option>` +
            vivos.map(n => `<option value="${n.id}">${n.numeroBezerro} (mãe ${n.vacaMaeNumero})</option>`).join("");
    }
}

function abrirTelaMorteMobile(){
    document.getElementById("morteMobTipoInput").value = "vaca";
    atualizarSelectAnimalMorteMobile();
    document.getElementById("morteMobCausaInput").value = "";
    let erroEl = document.getElementById("morteMobErro");
    if(erroEl){ erroEl.style.display = "none"; erroEl.innerText = ""; }
}

function confirmarMorteMobile(){
    let erroEl = document.getElementById("morteMobErro");
    function mostrarErro(msg){ if(erroEl){ erroEl.innerText = msg; erroEl.style.display = "block"; } }

    let tipo = document.getElementById("morteMobTipoInput").value;
    let animalId = document.getElementById("morteMobAnimalInput").value;
    if(!animalId){ mostrarErro("Selecione o animal."); return; }
    let causa = document.getElementById("morteMobCausaInput").value.trim() || null;
    let agora = new Date().toLocaleString("pt-BR");

    if(tipo === "vaca"){
        let lista = JSON.parse(localStorage.getItem("vacasMatriz") || "[]");
        let vaca = lista.find(v => v.id === animalId);
        if(!vaca){ mostrarErro("Vaca não encontrada — sincronize e tente de novo."); return; }
        vaca.status = "morta";
        vaca.dataMorte = agora;
        vaca.causaMorte = causa;
        vaca.sincronizado = false;
        localStorage.setItem("vacasMatriz", JSON.stringify(lista));
    } else {
        let lista = JSON.parse(localStorage.getItem("nascimentos") || "[]");
        let nascimento = lista.find(n => n.id === animalId);
        if(!nascimento){ mostrarErro("Bezerro não encontrado — sincronize e tente de novo."); return; }
        nascimento.status = "morto";
        nascimento.dataMorte = agora;
        nascimento.causaMorte = causa;
        nascimento.sincronizado = false;
        localStorage.setItem("nascimentos", JSON.stringify(lista));
    }

    alert("Morte registrada.");
    trocarTela("telaVacasMatrizMobile");
    sincronizarAgora();
}

function abrirTelaVacasListaMobile(){
    mostrarVacasListaMobile();
}

function mostrarVacasListaMobile(){
    let container = document.getElementById("listaVacasMobile");
    if(!container) return;
    let buscaEl = document.getElementById("buscaVacaMobile");
    let busca = (buscaEl ? buscaEl.value : "").toLowerCase();
    let vacas = obterVacasMatrizCacheMobile().filter(v =>
        !busca || v.numero.toLowerCase().includes(busca) || (v.apelido || "").toLowerCase().includes(busca)
    );
    if(vacas.length === 0){
        container.innerHTML = `<div class="listaPesosAtualVazia">Nenhuma vaca encontrada.</div>`;
        return;
    }
    let nascimentos = obterNascimentosCacheMobile();
    container.innerHTML = vacas.map(v => {
        let filhos = nascimentos.filter(n => n.vacaMaeNumero === v.numero).length;
        let statusTxt = v.status === "ativa" ? "✅ Ativa" : v.status === "morta" ? "⚰️ Morta" : "➖ Descartada";
        return `
            <div class="itemPesagem">
                <span><strong>${v.numero}</strong>${v.apelido ? " — " + v.apelido : ""}<br>${v.pastoNome || "Sem pasto"} · ${filhos} filho(s)</span>
                <span class="itemPesagemDireita">${statusTxt}</span>
            </div>
        `;
    }).join("");
}

function abrirTelaNascimentosListaMobile(){
    mostrarNascimentosListaMobile();
}

function mostrarNascimentosListaMobile(){
    let container = document.getElementById("listaNascimentosMobile");
    if(!container) return;
    let buscaEl = document.getElementById("buscaNascimentoMobile");
    let busca = (buscaEl ? buscaEl.value : "").toLowerCase();
    let nascimentos = obterNascimentosCacheMobile().filter(n =>
        !busca || n.numeroBezerro.toLowerCase().includes(busca) || n.vacaMaeNumero.toLowerCase().includes(busca)
    );
    if(nascimentos.length === 0){
        container.innerHTML = `<div class="listaPesosAtualVazia">Nenhum nascimento encontrado.</div>`;
        return;
    }
    container.innerHTML = nascimentos.map(n => {
        let statusTxt = n.status === "vivo" ? "🐮 Vivo" : n.status === "apartado" ? "✅ Apartado" : "⚰️ Morto";
        return `
            <div class="itemPesagem">
                <span><strong>${n.numeroBezerro}</strong> (mãe ${n.vacaMaeNumero})<br>${n.dataNascimento ? n.dataNascimento.split(",")[0] : "—"}</span>
                <span class="itemPesagemDireita">${statusTxt}</span>
            </div>
        `;
    }).join("");
}

// chamada depois de cada sincronização — atualiza a lista se a tela de
// consulta estiver aberta na hora, sem o usuário precisar sair e voltar.
function mostrarVacasMatrizMobile(){
    let telaVacas = document.getElementById("telaVacasListaMobile");
    if(telaVacas && telaVacas.classList.contains("ativa")) mostrarVacasListaMobile();
    let telaNasc = document.getElementById("telaNascimentosListaMobile");
    if(telaNasc && telaNasc.classList.contains("ativa")) mostrarNascimentosListaMobile();
}