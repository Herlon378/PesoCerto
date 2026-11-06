// ========================================
// CONFERÊNCIA DE PESO (carga comprada, repesada na chegada)
// ========================================
// Compra feita longe: ao chegar na fazenda o operador repesa a carga e vê a
// quebra em relação à primeira pesagem. A conferência é SÓ PRA CONSULTA:
// não pode mexer em compra, lote, saldo, custo, caixa nem numeração.
// Por isso ela é isolada de propósito:
//  - no aparelho fica em "conferencias" (nunca em "pesagens"), com rascunho
//    próprio em "conferenciaAtual" (nunca em "pesagemAtual");
//  - no servidor fica na tabela conferencias_peso, que nada mais lê;
//  - usa a tela de pesagem emprestada: finalizarPesagem() desvia pra cá e
//    salvarPesagem() (db.js) se recusa a gravar enquanto o modo estiver ligado;
//  - ao sair da pesagem o modo desliga e os pesos saem da memória, senão
//    eles entrariam na próxima pesagem de verdade.
let conferenciaAtiva = null;

function conferenciaEmAndamento(){ return !!conferenciaAtiva; }

function lerConferencias(chave){
    try { let l = JSON.parse(localStorage.getItem(chave || "conferencias") || "[]"); return Array.isArray(l) ? l : []; }
    catch(e){ return []; }
}

// conferência mais recente de um relatório (ou de qualquer lote da sessão dele)
function conferenciaDoRelatorio(r){
    if(!r) return null;
    let ids = new Set(obterRegistrosDaSessao(r).map(x => x && x.id));
    let achadas = lerConferencias().filter(c => ids.has(c.pesagemId) || (r.sessaoId && c.sessaoId === r.sessaoId));
    return achadas.length ? achadas[achadas.length - 1] : null;
}

function compraPodeSerConferida(r){
    return !!r && (r.tipo || "venda") === "compra" && obterRegistrosDaSessao(r).some(x => (x.pesos || []).some(p => Number(p.peso) > 0));
}

// toda a conta da conferência: compara a pesagem de origem (compra inteira,
// todos os lotes da sessão) com a da chegada. Os animais não têm como ser
// casados um a um, então a comparação é do total e da média.
function calcularConferencia(registros, conferencia){
    let pesosOrigem = [], valorPago = 0, rendimento = 0;
    registros.forEach(r => {
        let d = calcularDadosCompletos(r);
        valorPago += d.totalRS;
        if(d.ehArroba && !rendimento) rendimento = d.rendimentoNum;
        (r.pesos || []).forEach(p => pesosOrigem.push(Number(p.peso) || 0));
    });
    let pesosChegada = (conferencia.pesos || []).map(p => Number(p.peso) || 0);
    let soma = l => l.reduce((t, v) => t + v, 0);
    let comPeso = l => l.filter(v => v > 0);
    let animaisOrigem = pesosOrigem.length, animaisChegada = pesosChegada.length;
    let kgOrigem = soma(pesosOrigem), kgChegada = soma(pesosChegada);
    let mediaOrigem = animaisOrigem ? kgOrigem / animaisOrigem : 0;
    let mediaChegada = animaisChegada ? kgChegada / animaisChegada : 0;
    let perdaKg = kgOrigem - kgChegada;
    let rsKgPago = kgOrigem > 0 ? valorPago / kgOrigem : 0;
    return {
        pesosOrigem, pesosChegada, animaisOrigem, animaisChegada, kgOrigem, kgChegada, mediaOrigem, mediaChegada,
        maiorOrigem: comPeso(pesosOrigem).length ? Math.max(...comPeso(pesosOrigem)) : 0,
        menorOrigem: comPeso(pesosOrigem).length ? Math.min(...comPeso(pesosOrigem)) : 0,
        maiorChegada: comPeso(pesosChegada).length ? Math.max(...comPeso(pesosChegada)) : 0,
        menorChegada: comPeso(pesosChegada).length ? Math.min(...comPeso(pesosChegada)) : 0,
        perdaKg,
        quebraPct: kgOrigem > 0 ? perdaKg / kgOrigem * 100 : 0,
        perdaMedia: mediaOrigem - mediaChegada,
        quebraMediaPct: mediaOrigem > 0 ? (mediaOrigem - mediaChegada) / mediaOrigem * 100 : 0,
        difAnimais: animaisChegada - animaisOrigem,
        valorPago, rsKgPago,
        valorPerdido: perdaKg * rsKgPago,
        rsKgChegada: kgChegada > 0 ? valorPago / kgChegada : 0,
        rendimento,
        perdaArroba: rendimento ? converterParaArroba(perdaKg, rendimento) : 0
    };
}

let pctBR = v => Math.abs(v).toFixed(2).replace(".", ",") + "%";
let kgBR = v => formatarPeso(Math.round(Math.abs(v) * 10) / 10) + " kg";
let rotuloPerda = c => c.perdaKg >= 0 ? "Quebra" : "Ganho";

// ---------- começar / continuar a pesagem da conferência ----------
function preencherCamposConferencia(c){
    if(typeof fecharCriteriosExtras === "function") fecharCriteriosExtras();
    let definir = (id, v) => { let el = document.getElementById(id); if(el) el.value = v; };
    definir("tipoOperacao", "compra");
    definir("tipoPesagem", "vivo");
    definir("rendimentoArroba", "");
    definir("nomeVendedor", c.vendedor || "");
    definir("valorKg", "R$ " + formatarMoeda(c.rsKgPago || 0));
    definir("descricao", "");
    definir("pesoMin", ""); definir("pesoMax", "");
}

function limparCamposConferencia(){
    ["nomeVendedor", "valorKg", "descricao", "obs", "displayPeso"].forEach(id => { let el = document.getElementById(id); if(el) el.value = ""; });
    let tipo = document.getElementById("tipoOperacao");
    if(tipo) tipo.value = "venda";
    if(typeof aplicarRestricoesUsuario === "function") aplicarRestricoesUsuario();
    if(typeof alternarModoOperacao === "function") alternarModoOperacao();
}

// tira o aparelho do modo conferência: pesos fora da memória, campos limpos
function sairDoModoConferencia(){
    conferenciaAtiva = null;
    criteriosPesagem = [];
    criterioAtivoIndex = 0;
    pesos = [];
    limparCamposConferencia();
    atualizarFaixaConferencia();
}

function iniciarConferencia(r){
    if(pesos.length > 0 || criteriosPesagem.some(c => (c.pesos || []).length > 0) || localStorage.getItem("conferenciaAtual")){
        alert("Já existe uma pesagem em andamento. Finalize ou cancele ela antes.");
        return;
    }
    let registros = obterRegistrosDaSessao(r);
    let d = calcularConferencia(registros, { pesos: [] });
    conferenciaAtiva = {
        id: crypto.randomUUID(),
        pesagemId: registros[0].id,
        sessaoId: r.sessaoId || null,
        numero: r.numero || null,
        vendedor: r.vendedor || "",
        animaisOrigem: d.animaisOrigem,
        rsKgPago: Math.round(d.rsKgPago * 100) / 100
    };
    preencherCamposConferencia(conferenciaAtiva);
    montarCriteriosPesagem();
    criterioAtivoIndex = 0;
    pesos = criteriosPesagem[0].pesos;
    atualizarFaixaConferencia();
    abrirTelaPesagemOuBalanca();
}

// salvamento automático: rascunho PRÓPRIO, nunca o "pesagemAtual"
function salvarRascunhoConferencia(){
    if(!conferenciaAtiva) return;
    localStorage.setItem("conferenciaAtual", JSON.stringify({ ...conferenciaAtiva, pesos: pesos.map(p => ({ peso: p.peso, obs: p.obs || "" })) }));
}

// app reaberto com conferência pela metade: volta direto pra ela
function retomarConferenciaSeHouver(){
    if(!document.getElementById("telaPesagem") || !obterToken()) return;
    let rascunho = null;
    try { rascunho = JSON.parse(localStorage.getItem("conferenciaAtual")); } catch(e){}
    if(!rascunho || !rascunho.pesagemId) return;
    if(pesos.length > 0 || criteriosPesagem.some(c => (c.pesos || []).length > 0)) return;
    let { pesos: pesosSalvos, ...dados } = rascunho;
    conferenciaAtiva = dados;
    preencherCamposConferencia(dados);
    montarCriteriosPesagem();
    criterioAtivoIndex = 0;
    (pesosSalvos || []).forEach(p => {
        let item = montarItemPesoCriterio(criteriosPesagem[0], p.peso, p.obs);
        if(item) criteriosPesagem[0].pesos.push(item);
    });
    pesos = criteriosPesagem[0].pesos;
    atualizarFaixaConferencia();
    abrirTelaPesagemOuBalanca();
}

// chamado por trocarTela: saiu da pesagem sem finalizar? desliga o modo.
// O rascunho só fica se já tinha animal lançado.
function aoTrocarTelaConferencia(id){
    if(!conferenciaAtiva || id === "telaPesagem" || id === "telaConectarBalanca") return;
    if(pesos.length === 0) localStorage.removeItem("conferenciaAtual");
    sairDoModoConferencia();
}

// "Cancelar" da tela de pesagem (resetarPesagemAtual): joga fora o rascunho
function descartarConferencia(){
    localStorage.removeItem("conferenciaAtual");
    conferenciaAtiva = null;
    atualizarFaixaConferencia();
}

function atualizarFaixaConferencia(){
    let faixa = document.getElementById("faixaConferencia");
    if(!faixa) return;
    faixa.hidden = !conferenciaAtiva;
    if(!conferenciaAtiva) return;
    let c = conferenciaAtiva;
    document.getElementById("faixaConferenciaTexto").textContent =
        `Compra${c.numero ? " nº " + c.numero : ""} · ${pesos.length} de ${c.animaisOrigem} animais · não altera o sistema`;
}

function finalizarConferencia(){
    if(pesos.length === 0){ alert("Nenhum peso lançado!"); return; }
    let c = conferenciaAtiva;
    let registro = {
        id: c.id, pesagemId: c.pesagemId, sessaoId: c.sessaoId,
        pesos: pesos.map(p => ({ peso: p.peso, obs: p.obs || "" })),
        data: new Date().toLocaleString("pt-BR"),
        criadoPor: obterUsuarioLogado() || "",
        sincronizado: false
    };
    let lista = lerConferencias(); // relê: a sincronização pode ter mexido
    lista.push(registro);
    localStorage.setItem("conferencias", JSON.stringify(lista));
    localStorage.removeItem("conferenciaAtual");
    desconectarBalancaBluetooth();
    resetarEstadoCapturaBalanca();
    let labelPeso = document.getElementById("pesoAtualLabel");
    if(labelPeso){ labelPeso.textContent = "PESO ATUAL"; labelPeso.classList.remove("aoVivo"); }
    sairDoModoConferencia();
    abrirRelatorios();
    abrirConferencia(registro);
    sincronizarAgora();
}

// ---------- Relatórios: botão e selo no cartão ----------
function atualizarBotaoConferencia(r){
    let botao = document.getElementById("btnConferirPeso");
    if(!botao) return;
    let pode = compraPodeSerConferida(r);
    botao.hidden = !pode;
    if(!pode) return;
    let tem = conferenciaDoRelatorio(r);
    document.getElementById("btnConferirPesoTitulo").textContent = tem ? "Ver conferência" : "Conferir peso";
    document.getElementById("btnConferirPesoDetalhe").textContent = tem ? "Relatório salvo nesta compra" : "Repesar na chegada";
}

function conferirPesoDaCompra(){
    let sel = document.querySelector("input[name='relatorioSelecionado']:checked");
    let r = sel ? relatorios[sel.value] : null;
    if(!compraPodeSerConferida(r)){ alert("Selecione uma compra pesada na lista."); return; }
    let tem = conferenciaDoRelatorio(r);
    if(tem) abrirConferencia(tem);
    else iniciarConferencia(r);
}

function seloConferenciaCartao(r){
    let c = conferenciaDoRelatorio(r);
    if(!c) return "";
    let k = calcularConferencia(obterRegistrosDaSessao(r), c);
    return `<button type="button" class="seloConferencia" onclick="event.preventDefault(); event.stopPropagation(); abrirConferenciaPorId('${escaparHtmlPesagem(c.id)}')">
        <span>Ver relatório de conferência</span><b>${rotuloPerda(k)} ${pctBR(k.quebraPct)}</b></button>`;
}

function abrirConferenciaPorId(id){
    let c = lerConferencias().find(x => x.id === id);
    if(c) abrirConferencia(c);
}

// ---------- relatório de conferência (folha de impressão) ----------
let conferenciaAberta = null;

function registrosDaConferencia(c){
    let r = relatorios.find(x => x && x.id === c.pesagemId) || (c.sessaoId && relatorios.find(x => x && x.sessaoId === c.sessaoId));
    return r ? obterRegistrosDaSessao(r) : null;
}

function abrirConferencia(c){
    let registros = registrosDaConferencia(c);
    if(!registros){ alert("A compra desta conferência não foi encontrada."); return; }
    let r = registros[0], k = calcularConferencia(registros, c), esc = escaparHtmlPesagem;
    let rs = v => "R$ " + formatarMoeda(v);
    let perda = k.perdaKg >= 0;
    let quadro = (rotulo, valor, classe) => `<div class="folhaQuadro ${classe || ""}"><span>${rotulo}</span><b>${valor}</b></div>`;
    let linha = (nome, origem, chegada, dif) => `<tr><td class="folhaObs"><b>${nome}</b></td><td>${origem}</td><td>${chegada}</td><td>${dif}</td></tr>`;
    let difKg = (a, b) => (b - a > 0 ? "+" : b - a < 0 ? "−" : "") + kgBR(b - a);
    let linhasPesos = "";
    for(let i = 0; i < Math.max(k.pesosOrigem.length, k.pesosChegada.length); i++){
        let obs = (c.pesos[i] && c.pesos[i].obs) || "";
        linhasPesos += `<tr><td class="folhaNum">${i + 1}</td><td>${i < k.pesosOrigem.length ? formatarPeso(k.pesosOrigem[i]) + " kg" : "—"}</td><td>${i < k.pesosChegada.length ? formatarPeso(k.pesosChegada[i]) + " kg" : "—"}</td><td class="folhaObs">${esc(obs)}</td></tr>`;
    }
    let avisoAnimais = k.difAnimais !== 0
        ? `<p class="folhaConferenciaAviso">${k.difAnimais < 0 ? `${k.difAnimais === -1 ? "Falta" : "Faltam"} ${-k.difAnimais} ${k.difAnimais === -1 ? "animal" : "animais"} na chegada: a perda total inclui ${k.difAnimais === -1 ? "ele" : "eles"}.` : `Chegaram ${k.difAnimais} ${k.difAnimais === 1 ? "animal" : "animais"} a mais do que na compra.`} Pela média por animal, a ${k.perdaMedia >= 0 ? "quebra" : "variação"} é de <b>${pctBR(k.quebraMediaPct)}</b>.</p>`
        : "";

    document.getElementById("folhaRelatorio").innerHTML = `
        <header class="folhaTopo">
            <div>
                <div class="folhaFazenda">${esc(nomeFazendaAtual())}</div>
                <h1>Conferência de Peso</h1>
            </div>
            <div class="folhaTopoDireita">
                <span class="folhaSelo folhaSeloConferencia">CONFERÊNCIA</span>
                <small>Emitido em ${new Date().toLocaleString("pt-BR")}</small>
            </div>
        </header>
        <p class="folhaConferenciaNota">Documento apenas para conferência. Não altera a compra, os lotes, os custos nem o caixa.</p>
        <section class="folhaDados">
            <div><span>Compra</span><b>${r.numero ? "Nº " + r.numero : "Sem número"}</b></div>
            <div><span>Vendedor</span><b>${esc(r.vendedor || "Não informado")}</b></div>
            <div><span>${registros.length > 1 ? "Lotes" : "Lote"}</span><b>${esc(registros.map(x => x.descricao || "Sem lote").join(", "))}</b></div>
            <div><span>Data da compra</span><b>${esc(calcularDadosCompletos(r).dataHora)}</b></div>
            <div><span>Data da conferência</span><b>${esc(c.data || "—")}</b></div>
            <div><span>Conferido por</span><b>${esc(c.criadoPor || "—")}</b></div>
        </section>
        <section class="folhaResumo">
            ${quadro(perda ? "Perda de peso" : "Ganho de peso", kgBR(k.perdaKg), perda ? "folhaQuadroPerda" : "folhaQuadroDestaque")}
            ${quadro(rotuloPerda(k), pctBR(k.quebraPct), perda ? "folhaQuadroPerda" : "folhaQuadroDestaque")}
            ${quadro(perda ? "Valor perdido" : "Valor ganho", rs(Math.abs(k.valorPerdido)), perda ? "folhaQuadroPerda" : "folhaQuadroDestaque")}
            ${quadro("Média por animal", (k.perdaMedia >= 0 ? "−" : "+") + kgBR(k.perdaMedia))}
            ${quadro("Valor pago", rs(k.valorPago))}
            ${quadro("R$/kg pago", rs(k.rsKgPago))}
            ${quadro("R$/kg na chegada", rs(k.rsKgChegada))}
            ${k.rendimento ? quadro("Perda em arrobas", Math.abs(k.perdaArroba).toFixed(2).replace(".", ",") + " @") : ""}
        </section>
        ${avisoAnimais}
        <h2 class="folhaSecao">Comparativo</h2>
        <table class="folhaTabela"><thead><tr><th></th><th>Origem</th><th>Chegada</th><th>Diferença</th></tr></thead><tbody>
            ${linha("Animais", k.animaisOrigem, k.animaisChegada, (k.difAnimais > 0 ? "+" : "") + k.difAnimais)}
            ${linha("Peso total", formatarPeso(k.kgOrigem) + " kg", formatarPeso(k.kgChegada) + " kg", difKg(k.kgOrigem, k.kgChegada))}
            ${linha("Peso médio", kgBR(k.mediaOrigem), kgBR(k.mediaChegada), difKg(k.mediaOrigem, k.mediaChegada))}
            ${linha("Mais pesado", kgBR(k.maiorOrigem), kgBR(k.maiorChegada), difKg(k.maiorOrigem, k.maiorChegada))}
            ${linha("Mais leve", kgBR(k.menorOrigem), kgBR(k.menorChegada), difKg(k.menorOrigem, k.menorChegada))}
        </tbody></table>
        <h2 class="folhaSecao">Lista de pesos <small>na ordem em que foram pesados — a mesma linha não é o mesmo animal</small></h2>
        <table class="folhaTabela"><thead><tr><th>Nº</th><th>Origem</th><th>Chegada</th><th>Obs.</th></tr></thead><tbody>${linhasPesos}</tbody></table>
        <footer class="folhaRodape"><small>Relatório gerado pelo PesoCerto</small></footer>
    `;

    conferenciaAberta = c;
    let tela = document.getElementById("telaImpressao");
    tela.classList.remove("modoExtrato");
    tela.classList.add("modoConferencia");
    prepararAcoesConferencia(c);
    let titulo = document.getElementById("impressaoTitulo");
    if(titulo) titulo.innerText = `Conferência${r.numero ? " da compra nº " + r.numero : ""}`;
    trocarTela("telaImpressao");
    window.scrollTo(0, 0);
}

function prepararAcoesConferencia(c){
    let tela = document.getElementById("telaImpressao");
    let barra = document.getElementById("acoesConferencia");
    if(!barra){
        barra = document.createElement("div");
        barra.id = "acoesConferencia";
        barra.className = "acoesConferencia";
        barra.innerHTML = `
            <button type="button" onclick="baixarPdfConferencia()">PDF</button>
            <button type="button" onclick="enviarConferenciaWhatsApp()">WhatsApp</button>
            <button type="button" class="acoesConferenciaExcluir" id="btnExcluirConferencia" onclick="excluirConferenciaAberta()">Excluir</button>`;
        tela.insertBefore(barra, document.getElementById("folhaRelatorio"));
    }
    let podeExcluir = obterPapelLogado() === "admin" || c.criadoPor === obterUsuarioLogado();
    document.getElementById("btnExcluirConferencia").style.display = podeExcluir ? "" : "none";
}

function textoConferencia(registros, c){
    let r = registros[0], k = calcularConferencia(registros, c);
    return [
        `*Conferência de peso — compra${r.numero ? " nº " + r.numero : ""}*`,
        `Vendedor: ${r.vendedor || "Não informado"}`,
        `Lote: ${registros.map(x => x.descricao || "Sem lote").join(", ")}`,
        `Origem: ${k.animaisOrigem} animais · ${formatarPeso(k.kgOrigem)} kg · média ${kgBR(k.mediaOrigem)}`,
        `Chegada: ${k.animaisChegada} animais · ${formatarPeso(k.kgChegada)} kg · média ${kgBR(k.mediaChegada)}`,
        `${k.perdaKg >= 0 ? "Perda" : "Ganho"}: ${kgBR(k.perdaKg)} (${pctBR(k.quebraPct)})`,
        `${k.perdaKg >= 0 ? "Valor perdido" : "Valor ganho"}: R$ ${formatarMoeda(Math.abs(k.valorPerdido))}`
    ].join("\n");
}

function enviarConferenciaWhatsApp(){
    let registros = conferenciaAberta && registrosDaConferencia(conferenciaAberta);
    if(registros) window.open("https://wa.me/?text=" + encodeURIComponent(textoConferencia(registros, conferenciaAberta)), "_blank");
}

function excluirConferenciaAberta(){
    let c = conferenciaAberta;
    if(!c || !confirm("Excluir este relatório de conferência? A compra não muda em nada.")) return;
    localStorage.setItem("conferencias", JSON.stringify(lerConferencias().filter(x => x.id !== c.id)));
    // sempre avisa o servidor: a cópia aberta na tela pode estar desatualizada
    // (a sincronização pode ter enviado depois). Se ele não tiver, responde
    // 404 e o pedido sai da fila; sem isso a conferência voltava sozinha.
    let fila = lerConferencias("conferenciasExclusoes");
    fila.push(c.id);
    localStorage.setItem("conferenciasExclusoes", JSON.stringify(fila));
    conferenciaAberta = null;
    abrirRelatorios();
    sincronizarAgora();
}

function montarPdfConferencia(registros, c){
    let r = registros[0], k = calcularConferencia(registros, c);
    const { jsPDF } = window.jspdf;
    let pdf = new jsPDF({ unit: "mm", format: "a4" });
    const L = 12, R = 198, W = R - L, BASE = 282;
    const ESCURO = [29, 36, 51], CINZA = [107, 114, 128], AZUL = [43, 90, 163];
    let y = 14;
    let fonte = (t, n) => { pdf.setFont("helvetica", n ? "bold" : "normal"); pdf.setFontSize(t); };
    let cor = c2 => pdf.setTextColor(...c2);
    fonte(9, true); cor(AZUL); pdf.text(nomeFazendaAtual().toUpperCase(), L, y + 3);
    fonte(18, true); cor(ESCURO); pdf.text("Conferência de Peso", L, y + 11);
    fonte(7.5, false); cor(CINZA); pdf.text("Emitido em " + new Date().toLocaleString("pt-BR"), R, y + 11, { align: "right" });
    y += 15; pdf.setDrawColor(...ESCURO); pdf.setLineWidth(0.9); pdf.line(L, y, R, y); y += 6;
    fonte(8.5, false); cor(CINZA); pdf.text("Documento apenas para conferência. Não altera a compra, os lotes, os custos nem o caixa.", L, y); y += 7;
    [["COMPRA", r.numero ? "Nº " + r.numero : "Sem número"], ["VENDEDOR", r.vendedor || "Não informado"], ["LOTE", registros.map(x => x.descricao || "Sem lote").join(", ")],
     ["DATA DA COMPRA", calcularDadosCompletos(r).dataHora], ["CONFERÊNCIA", c.data || "—"], ["CONFERIDO POR", c.criadoPor || "—"]].forEach(([rot, val], i) => {
        let x = L + (i % 3) * (W / 3), yy = y + Math.floor(i / 3) * 11;
        fonte(7, true); cor(CINZA); pdf.text(rot, x, yy);
        fonte(9.5, true); cor(ESCURO); pdf.text(String(val).slice(0, 34), x, yy + 5);
    });
    y += 24;
    let perda = k.perdaKg >= 0;
    let quadros = [[perda ? "PERDA DE PESO" : "GANHO DE PESO", kgBR(k.perdaKg), 1], [rotuloPerda(k).toUpperCase(), pctBR(k.quebraPct), 1],
        [perda ? "VALOR PERDIDO" : "VALOR GANHO", "R$ " + formatarMoeda(Math.abs(k.valorPerdido)), 1], ["MÉDIA POR ANIMAL", (k.perdaMedia >= 0 ? "−" : "+") + kgBR(k.perdaMedia)],
        ["VALOR PAGO", "R$ " + formatarMoeda(k.valorPago)], ["R$/KG PAGO", "R$ " + formatarMoeda(k.rsKgPago)], ["R$/KG NA CHEGADA", "R$ " + formatarMoeda(k.rsKgChegada)]];
    if(k.rendimento) quadros.push(["PERDA EM ARROBAS", Math.abs(k.perdaArroba).toFixed(2).replace(".", ",") + " @"]);
    let larg = (W - 7.5) / 4;
    quadros.forEach(([rot, val, destaque], i) => {
        let x = L + (i % 4) * (larg + 2.5), yy = y + Math.floor(i / 4) * 15;
        pdf.setFillColor(...(destaque ? (perda ? [254, 242, 242] : [236, 253, 243]) : [248, 250, 252]));
        pdf.setDrawColor(...(destaque ? (perda ? [248, 113, 113] : [52, 211, 153]) : [223, 227, 234])); pdf.setLineWidth(0.3);
        pdf.roundedRect(x, yy, larg, 12.5, 1.8, 1.8, "FD");
        fonte(6.5, true); cor(CINZA); pdf.text(rot, x + 2.5, yy + 4.3);
        fonte(10.5, true); cor(destaque ? (perda ? [185, 28, 28] : [4, 120, 87]) : ESCURO); pdf.text(val, x + 2.5, yy + 9.8);
    });
    y += Math.ceil(quadros.length / 4) * 15 + 3;
    let tabela = (cabecalho, larguras, linhas) => {
        let topo = () => {
            pdf.setFillColor(...ESCURO); pdf.rect(L, y, W, 6.2, "F"); fonte(7, true); cor([255, 255, 255]);
            let x = L; cabecalho.forEach((t, i) => { pdf.text(t, x + 2, y + 4.2); x += larguras[i]; }); y += 6.2;
        };
        topo();
        linhas.forEach((l, n) => {
            if(y + 5.6 > BASE){ pdf.addPage(); y = 14; topo(); }
            if(n % 2){ pdf.setFillColor(246, 248, 251); pdf.rect(L, y, W, 5.6, "F"); }
            fonte(8.3, false); cor(ESCURO);
            let x = L; l.forEach((t, i) => { pdf.text(String(t), x + 2, y + 3.9); x += larguras[i]; }); y += 5.6;
        });
        y += 5;
    };
    let dif = (a, b) => (b - a > 0 ? "+" : b - a < 0 ? "−" : "") + kgBR(b - a);
    tabela(["", "ORIGEM", "CHEGADA", "DIFERENÇA"], [51, 45, 45, 45], [
        ["Animais", k.animaisOrigem, k.animaisChegada, (k.difAnimais > 0 ? "+" : "") + k.difAnimais],
        ["Peso total", formatarPeso(k.kgOrigem) + " kg", formatarPeso(k.kgChegada) + " kg", dif(k.kgOrigem, k.kgChegada)],
        ["Peso médio", kgBR(k.mediaOrigem), kgBR(k.mediaChegada), dif(k.mediaOrigem, k.mediaChegada)],
        ["Mais pesado", kgBR(k.maiorOrigem), kgBR(k.maiorChegada), dif(k.maiorOrigem, k.maiorChegada)],
        ["Mais leve", kgBR(k.menorOrigem), kgBR(k.menorChegada), dif(k.menorOrigem, k.menorChegada)]
    ]);
    let linhas = [];
    for(let i = 0; i < Math.max(k.pesosOrigem.length, k.pesosChegada.length); i++){
        linhas.push([i + 1, i < k.pesosOrigem.length ? formatarPeso(k.pesosOrigem[i]) + " kg" : "—", i < k.pesosChegada.length ? formatarPeso(k.pesosChegada[i]) + " kg" : "—", String((c.pesos[i] && c.pesos[i].obs) || "").slice(0, 40)]);
    }
    tabela(["Nº", "ORIGEM", "CHEGADA", "OBS."], [20, 45, 45, 76], linhas);
    let total = pdf.getNumberOfPages();
    for(let i = 1; i <= total; i++){
        pdf.setPage(i); fonte(7.5, false); cor([156, 163, 175]);
        pdf.text("Relatório gerado pelo PesoCerto", L, 290);
        pdf.text(`Página ${i} de ${total}`, R, 290, { align: "right" });
    }
    return pdf;
}

async function baixarPdfConferencia(){
    let registros = conferenciaAberta && registrosDaConferencia(conferenciaAberta);
    if(!registros) return;
    try {
        await entregarPdf(montarPdfConferencia(registros, conferenciaAberta), "Conferencia_" + nomeArquivoPesagem(registros[0], "pdf"));
    } catch(e){
        alert("Ocorreu um erro ao gerar o PDF: " + e.message);
    }
}

// ---------- sincronização (fila própria, separada da das pesagens) ----------
// Roda depois das pesagens e nunca derruba a sincronização principal. Relê o
// localStorage antes de cada gravação: o operador pode finalizar outra
// conferência enquanto um pedido está no ar.
async function sincronizarConferencias(token){
    try {
        const pedir = (rota, opcoes) => fetch(API_URL + rota, { ...(opcoes || {}), signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token } });
        for(let id of lerConferencias("conferenciasExclusoes")){
            let resp = await pedir("/api/conferencias/" + encodeURIComponent(id), { method: "DELETE" });
            if(!resp.ok && resp.status !== 404) continue;
            localStorage.setItem("conferenciasExclusoes", JSON.stringify(lerConferencias("conferenciasExclusoes").filter(x => x !== id)));
        }
        for(let c of lerConferencias().filter(x => !x.sincronizado && !x.recusada)){
            if(!lerConferencias().some(x => x.id === c.id)) continue; // excluída enquanto a fila andava
            let resp = await pedir("/api/conferencias", { method: "POST", body: JSON.stringify(c) });
            let mudar = fn => localStorage.setItem("conferencias", JSON.stringify(fn(lerConferencias())));
            if(resp.ok) mudar(l => l.map(x => x.id === c.id ? { ...x, sincronizado: true } : x));
            else if(resp.status === 404){
                // compra excluída: a conferência dela não tem mais pra onde ir
                let compraExiste = JSON.parse(localStorage.getItem("pesagens") || "[]").some(p => p && p.id === c.pesagemId);
                if(!compraExiste) mudar(l => l.filter(x => x.id !== c.id));
            }
            else if(resp.status === 400 || resp.status === 403) mudar(l => l.map(x => x.id === c.id ? { ...x, recusada: true } : x));
        }
        let resp = await pedir("/api/conferencias");
        if(!resp.ok) return;
        let doServidor = await resp.json();
        let locais = lerConferencias();
        let pendentes = locais.filter(x => !x.sincronizado);
        let idsFora = new Set([...lerConferencias("conferenciasExclusoes"), ...pendentes.map(x => x.id)]);
        localStorage.setItem("conferencias", JSON.stringify([...doServidor.filter(x => !idsFora.has(x.id)).map(x => ({ ...x, sincronizado: true })), ...pendentes]));
    } catch(e){
        console.warn("conferências não sincronizadas agora:", e.message);
    }
}
