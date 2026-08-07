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
    trocarTela("telaPesagem");
    atualizarStats();
}

function novaPesagem() {
    if(pesos.length > 0 && !confirm("Deseja descartar a pesagem atual e iniciar uma nova?")) return;
    pesos = [];
    
    let nv = document.getElementById("nomeVendedor");
    let desc = document.getElementById("descricao");
    let obs = document.getElementById("obs");
    let vKg = document.getElementById("valorKg");
    let dPeso = document.getElementById("displayPeso");
    let tipoEl = document.getElementById("tipoOperacao");

    if(nv) nv.value = "";
    if(desc) desc.value = "";
    if(obs) obs.value = "";
    if(vKg) vKg.value = "";
    if(dPeso) dPeso.value = "";
    if(tipoEl) tipoEl.value = "venda";
    
    localStorage.removeItem("pesagemAtual");
    atualizarStats();
    trocarTela("telaInicial");
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
    if(!confirm("Deseja finalizar esta pesagem?")) return;

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

function atualizarStats(){
    let qtd = pesos.length;
    let total = pesos.reduce((a, b) => a + b.peso, 0);
    let media = qtd > 0 ? Math.round(total / qtd) : 0;
    let ultimo = qtd > 0 ? pesos[qtd - 1].peso : 0;

    let vKgEl = document.getElementById("valorKg");
    let valorKgTexto = vKgEl ? vKgEl.value : "0";
    let valorKgNum = parseFloat(valorKgTexto.replace("R$ ", "").replace(/\./g, "").replace(",", ".")) || 0;

    let ultimoValor = ultimo * valorKgNum;
    let totalValor = total * valorKgNum;

    let qtdEl = document.getElementById("qtd");
    let medEl = document.getElementById("media");
    let totEl = document.getElementById("total");
    let ultEl = document.getElementById("ultimo");
    let uValEl = document.getElementById("ultimoValor");
    let tValEl = document.getElementById("totalValor");

    if(qtdEl) qtdEl.innerText = qtd;
    if(medEl) medEl.innerText = media;
    if(totEl) totEl.innerText = formatarPeso(total);
    if(ultEl) ultEl.innerText = formatarPeso(ultimo);
    if(uValEl) uValEl.innerText = "R$ " + ultimoValor.toFixed(2).replace(".", ",");
    if(tValEl) tValEl.innerText = "R$ " + totalValor.toFixed(2).replace(".", ",");

    let listaHTML = "";
    if(pesos.length === 0){
        listaHTML = `<div class="listaPesosAtualVazia">Nenhum peso lançado ainda</div>`;
    } else {
        [...pesos].reverse().forEach((p, idx) => {
            let originalIdx = pesos.length - 1 - idx;
            listaHTML += `
                <div class="itemPesagem">
                    <span>#${originalIdx + 1} - <b>${formatarPeso(p.peso)} kg</b> ${p.obs ? `(${p.obs})` : ''}</span>
                    <span class="itemPesagemDireita">
                        <span style="color:#2e7d32">R$ ${(p.peso * valorKgNum).toFixed(2).replace(".", ",")}</span>
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

    let elAtivos = document.getElementById("dashAtivos");
    let elComprados = document.getElementById("dashComprados");
    let elVendidos = document.getElementById("dashVendidos");
    let elKgCompra = document.getElementById("dashKgCompra");
    let elKgVenda = document.getElementById("dashKgVenda");
    let elValorCompra = document.getElementById("dashValorCompra");
    let elValorVenda = document.getElementById("dashValorVenda");

    if(elAtivos) elAtivos.innerText = animaisAtivos;
    if(elComprados) elComprados.innerText = animaisComprados;
    if(elVendidos) elVendidos.innerText = animaisVendidos;
    if(elKgCompra) elKgCompra.innerText = formatarPeso(kgCompra);
    if(elKgVenda) elKgVenda.innerText = formatarPeso(kgVenda);
    if(elValorCompra) elValorCompra.innerText = "R$ " + valorCompra.toFixed(2).replace(".", ",");
    if(elValorVenda) elValorVenda.innerText = "R$ " + valorVenda.toFixed(2).replace(".", ",");
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
        pdf.text(`Média por Animal: ${d.mediaKg} kg`, 110, y);

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
            let valorInd = pAtual * d.valorKgNum; // CORRIGIDO AQUI (Removido o "s" incorreto)
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
    
    let listaPesos = r.pesos ? r.pesos.map(p => p.peso || 0) : [];
    let pesosOrdenados = [...listaPesos].sort((a, b) => a - b);
    let totalKg = pesosOrdenados.reduce((sum, w) => sum + w, 0);
    let totalAnimais = pesosOrdenados.length;
    
    return {
        valorKgNum: valorKgNum,
        totalKg: totalKg,
        totalAnimais: totalAnimais,
        mediaKg: totalAnimais ? Math.round(totalKg / totalAnimais) : 0,
        totalRS: totalKg * valorKgNum,
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
        <p><b>Total Animais:</b> ${d.totalAnimais} &nbsp;&nbsp;&nbsp;&nbsp; <b>Média Lote:</b> ${d.mediaKg} kg</p>
        <p><b>Peso Acumulado:</b> ${formatarPeso(d.totalKg)} kg &nbsp;&nbsp;&nbsp;&nbsp; <b>Faturamento Total:</b> R$ ${d.totalRS.toFixed(2).replace(".", ",")}</p>
        <br>
        <table border="1" style="width:100%; border-collapse:collapse; text-align:center;">
            <thead>
                <tr style="background:#eee"><th>Nº</th><th>Peso</th><th>Valor Individual</th><th>Observação</th></tr>
            </thead>
            <tbody>
    `;
    
    r.pesos.forEach((p, i) => {
        let pAtual = p.peso || 0;
        let vInd = pAtual * d.valorKgNum;
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
    let dataExcel = [];
    
    r.pesos.forEach((p, i) => {
        dataExcel.push({
            "Ordem": i + 1,
            "Peso (kg)": p.peso || 0,
            "Anotação": p.obs || ""
        });
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
    
    relatorios.splice(sel.value, 1);
    localStorage.setItem("pesagens", JSON.stringify(relatorios));
    mostrarRelatorios();
}

// ========================================
// INICIALIZAÇÃO ÚNICA (ONLOAD)
// ========================================
window.onload = function() {
    relatorios = JSON.parse(localStorage.getItem("pesagens") || "[]");
    if(typeof restaurarPesagem === "function") {
        restaurarPesagem();
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