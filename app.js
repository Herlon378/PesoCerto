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
    mostrarDashboard();
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

    localStorage.removeItem("pesagemAtual");
    atualizarStats();
    trocarTela("telaInicial");
}

function novaPesagem() {
    if(pesos.length > 0 && !confirm("Deseja descartar a pesagem atual e iniciar uma nova?")) return;
    resetarPesagemAtual();
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
    if(uValEl) uValEl.innerText = "R$ " + ultimoValor.toFixed(2).replace(".", ",");
    if(tValEl) tValEl.innerText = "R$ " + totalValor.toFixed(2).replace(".", ",");

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
                        <span style="color:#2e7d32">R$ ${valorItem.toFixed(2).replace(".", ",")}</span>
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

    if(relatorios.length === 0){
        container.innerHTML = "<p style='text-align:center; padding:20px; color:#666;'>Nenhum relatório salvo.</p>";
        return;
    }

    let html = "";
    [...relatorios].reverse().forEach((r, idx) => {
        let originalIndex = relatorios.length - 1 - idx;
        let totalKg = r.pesos ? r.pesos.reduce((a, b) => a + (b.peso || 0), 0) : 0;
        let tipo = r.tipo || "venda";
        let tagTipo = tipo === "compra"
            ? `<span class="tagTipo tagTipoCompra">COMPRA</span>`
            : `<span class="tagTipo tagTipoVenda">VENDA</span>`;

        html += `
            <div class="cardRelatorio">
                <label>
                    <input type="radio" name="relatorioSelecionado" value="${originalIndex}">
                    <div class="infoRelatorio">
                        ${tagTipo}<br>
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

function mostrarDashboard(){
    let animaisComprados = 0, animaisVendidos = 0;
    let kgCompra = 0, kgVenda = 0;
    let valorCompra = 0, valorVenda = 0;

    relatorios.forEach(r => {
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
    set("dashValorCompra", "R$ " + valorCompra.toFixed(2).replace(".", ","));
    set("dashValorVenda", "R$ " + valorVenda.toFixed(2).replace(".", ","));

    // cartões extras e comparativo Compra x Venda (só existem na tela de gerenciamento)
    let elSaldo = document.getElementById("dashSaldo");
    if(elSaldo){
        let positivo = saldo >= 0;
        elSaldo.innerText = (positivo ? "▲ R$ " : "▼ R$ ") + Math.abs(saldo).toFixed(2).replace(".", ",");
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
    let valor = input.value.replace(/\D/g, "");
    valor = (valor / 100).toFixed(2).replace(".", ",");
    input.value = valor === "0,00" ? "" : "R$ " + valor;
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
        pdf.line(10, 25, 200, 25);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        let y = 35;
        
        pdf.text(`Vendedor: ${r.vendedor || 'Geral'}`, 10, y);
        pdf.text(`Data/Hora: ${d.dataHora}`, 110, y);
        
        y += 7;
        pdf.text(`Lote/Desc: ${r.descricao || 'Sem Descrição'}`, 10, y);
        pdf.text(`Valor base/kg: R$ ${d.valorKgNum.toFixed(2).replace(".", ",")}`, 110, y);
        
        y += 7;
        pdf.text(`Total de Cabeças: ${d.totalAnimais}`, 10, y);
        pdf.text(`Peso Acumulado: ${formatarPeso(d.totalKg)} kg`, 110, y);
        
        y += 7;
        pdf.text(`Faturamento Lote: R$ ${d.totalRS.toFixed(2).replace(".", ",")}`, 10, y);
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
            pdf.text(`R$ ${valorInd.toFixed(2).replace(".", ",")}`, 90, y);
            pdf.text(p.obs || "-", 150, y);
            y += 7;
        });

        let pluginsNativos = window.Capacitor ? window.Capacitor.Plugins : null;
        if (!pluginsNativos || !pluginsNativos.Filesystem || !pluginsNativos.Share) {
            alert("Salvando arquivo localmente...");
            pdf.save(`Pesagem_${(r.vendedor || 'lote').replace(/\s+/g, '_')}.pdf`);
            return;
        }

        let pdfOutput = pdf.output('datauristring');
        let base64Data = pdfOutput.split(',')[1];
        let nomeArquivo = `Pesagem_${(r.vendedor || 'lote').replace(/\s+/g, '_')}.pdf`;

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
        <h2>Pesagem Estância Reis</h2>
        <hr>
        <p><b>Vendedor:</b> ${r.vendedor || "-"} &nbsp;&nbsp;&nbsp;&nbsp; <b>Data:</b> ${d.dataHora}</p>
        <p><b>Descrição:</b> ${r.descricao || "-"} &nbsp;&nbsp;&nbsp;&nbsp; <b>Valor por Kg:</b> R$ ${d.valorKgNum.toFixed(2).replace(".", ",")}</p>
        <p><b>Total Animais:</b> ${d.totalAnimais} &nbsp;&nbsp;&nbsp;&nbsp; <b>Média Lote:</b> ${d.mediaKg.toFixed(2).replace(".", ",")} kg</p>
        <p><b>Peso Acumulado:</b> ${formatarPeso(d.totalKg)} kg &nbsp;&nbsp;&nbsp;&nbsp; <b>Faturamento Total:</b> R$ ${d.totalRS.toFixed(2).replace(".", ",")}</p>
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
        html += `<tr><td>${i+1}</td><td>${formatarPeso(pAtual)} kg</td><td>R$ ${vInd.toFixed(2).replace(".", ",")}</td><td>${p.obs || "-"}</td></tr>`;
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
    XLSX.writeFile(workbook, `Pesagem_${(r.vendedor || 'lote').replace(/\s+/g, '_')}.xlsx`);
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

function abrirModalLogin(obrigatorio){
    let modal = document.getElementById("modalLogin");
    if(!modal) return;
    let erroEl = document.getElementById("loginErro");
    if(erroEl){ erroEl.style.display = "none"; erroEl.innerText = ""; }
    let campoUsuario = document.getElementById("loginUsuario");
    let campoSenha = document.getElementById("loginSenha");
    if(campoUsuario) campoUsuario.value = "";
    if(campoSenha) campoSenha.value = "";
    let btnCancelar = document.getElementById("btnCancelarLogin");
    if(btnCancelar) btnCancelar.style.display = obrigatorio ? "none" : "block";
    let tituloEl = document.getElementById("loginTitulo");
    if(tituloEl) tituloEl.innerText = obrigatorio ? "👤 Entre para usar o app" : "👤 Entrar";
    modal.style.display = "flex";
    if(campoUsuario) campoUsuario.focus();
}

function fecharModalLogin(){
    let modal = document.getElementById("modalLogin");
    if(modal) modal.style.display = "none";
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
        fecharModalLogin();
        atualizarBotaoLogin();
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
    atualizarBotaoLogin();
    atualizarStatusSync("👤 Não conectado");
}

function atualizarBotaoLogin(){
    let btn = document.getElementById("btnLoginLogout");
    if(!btn) return;
    let nome = obterUsuarioLogado();
    if(nome){
        btn.innerText = "🚪 Sair (" + nome + ")";
        btn.onclick = sair;
    } else {
        btn.innerText = "👤 Entrar";
        btn.onclick = abrirModalLogin;
    }

    let navUsuarios = document.querySelector('[data-tela="telaUsuarios"]');
    if(navUsuarios){
        navUsuarios.style.display = (obterPapelLogado() === "admin") ? "inline-block" : "none";
    }
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
        if(naoSincronizados.length > 0){
            let resp = await fetch(`${API_URL}/api/pesagens/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify({ pesagens: naoSincronizados })
            });
            if(resp.status === 401) sessaoExpirada = true;
            if(!resp.ok) throw new Error(sessaoExpirada ? "sessão expirada, faça login de novo" : "falha ao enviar");
            naoSincronizados.forEach(r => r.sincronizado = true);
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
            mostrarDashboard();
        }

        atualizarStatusSync("✅ Sincronizado às " + new Date().toLocaleTimeString("pt-BR"));
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
window.onload = function() {
    relatorios = JSON.parse(localStorage.getItem("pesagens") || "[]");
    if(typeof restaurarPesagem === "function") {
        restaurarPesagem();
    }
    inicializarSliderFinalizar();
    atualizarBotaoLogin();
    sincronizarAgora();

    if(!obterToken()){
        abrirModalLogin(true);
    }
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