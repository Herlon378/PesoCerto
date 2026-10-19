// ========================================
// VARIÁVEIS GLOBAIS
// ========================================
let pesos = [];
let relatorios = [];
let audioCtx = null;
let indicePesoParaExcluir = null;

// ========================================
// SISTEMA DE SOM (BIP + CLIQUE DO TECLADO)
// ========================================
// Por que o bip falhava "na maioria das vezes" no curral:
// 1. o bip era curto (80ms) e grave (900Hz) -- alto-falante de celular quase
//    não reproduz grave, e o Android "adormece" a saída de áudio depois de
//    alguns segundos de silêncio: ao acordar, ele engole o começo do som. Um
//    bip de 80ms cabia inteiro nesse pedaço engolido.
// 2. o lançamento automático da balança vem de um evento Bluetooth, não de
//    um toque na tela -- se o áudio estava suspenso (tela bloqueou, trocou
//    de app), o Chrome não deixa retomar sem um toque, e o bip sumia calado.
// Correções: bip agudo (faixa onde o alto-falante do celular é mais alto),
// duplo e mais longo; saída de áudio mantida acordada durante a pesagem
// (um tom inaudível contínuo); áudio "destravado" a cada toque na tela; e
// vibração junto, pra quando o barulho do curral cobrir o som.
function obterAudioCtx(){
    if(!audioCtx || audioCtx.state === "closed"){
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function destravarAudio(){
    try{
        let ctx = obterAudioCtx();
        if(ctx.state !== "running") ctx.resume().catch(() => {});
    }catch(e){}
}

["pointerdown", "touchstart", "keydown"].forEach(evento => {
    document.addEventListener(evento, destravarAudio, { capture: true, passive: true });
});
document.addEventListener("visibilitychange", () => {
    if(document.visibilityState === "visible") destravarAudio();
});

// tom quase zero e grave demais pra ouvir, tocando sem parar enquanto a
// tela de pesagem está aberta -- só pra saída de áudio do Android não
// dormir entre um animal e outro
let audioMantenedor = null;
function manterSaidaAudioAcordada(ligar){
    try{
        if(ligar && !audioMantenedor){
            let ctx = obterAudioCtx();
            let oscilador = ctx.createOscillator();
            let ganho = ctx.createGain();
            oscilador.frequency.value = 20;
            ganho.gain.value = 0.001;
            oscilador.connect(ganho);
            ganho.connect(ctx.destination);
            oscilador.start();
            audioMantenedor = { oscilador, ganho };
        }else if(!ligar && audioMantenedor){
            audioMantenedor.oscilador.stop();
            audioMantenedor.oscilador.disconnect();
            audioMantenedor.ganho.disconnect();
            audioMantenedor = null;
        }
    }catch(e){}
}

// atrasoSegundos permite encadear tons (bip duplo). Envelope curto de
// subida/descida evita o "estalo" e deixa o volume cheio o tempo todo.
function tocarTom(frequencia, duracaoSegundos, tipoOnda, volume, atrasoSegundos){
    try {
        let ctx = obterAudioCtx();
        function tocar(){
            let inicio = ctx.currentTime + 0.02 + (atrasoSegundos || 0);
            let fim = inicio + duracaoSegundos;
            let oscilador = ctx.createOscillator();
            let ganho = ctx.createGain();
            oscilador.connect(ganho);
            ganho.connect(ctx.destination);
            oscilador.frequency.value = frequencia;
            oscilador.type = tipoOnda;
            ganho.gain.setValueAtTime(0, inicio);
            ganho.gain.linearRampToValueAtTime(volume, inicio + 0.005);
            ganho.gain.setValueAtTime(volume, fim - 0.01);
            ganho.gain.linearRampToValueAtTime(0, fim);
            oscilador.start(inicio);
            oscilador.stop(fim + 0.02);
        }
        if(ctx.state === "running"){
            tocar();
        } else {
            // tenta retomar; se o Chrome não liberar logo (sem toque na
            // tela), desiste em vez de soltar vários bips atrasados depois
            let liberou = false;
            ctx.resume().then(() => { liberou = true; tocar(); }).catch(() => {});
            setTimeout(() => { if(!liberou && typeof logBalanca === "function") logBalanca("som bloqueado pelo navegador (toque na tela libera)"); }, 400);
        }
    } catch(e){}
}

// "peso lançado": bi-bip agudo e alto + vibração
function bip(){
    tocarTom(2700, 0.13, "square", 0.7);
    tocarTom(2700, 0.13, "square", 0.7, 0.19);
    try{ if(navigator.vibrate) navigator.vibrate([120, 70, 120]); }catch(e){}
}

// clique curto e mais agudo que o bip de "peso lançado" -- feedback sonoro
// de cada tecla do teclado numérico, pro operador no curral (sol forte,
// tela difícil de ver, ambiente barulhento) confirmar por áudio que
// apertou o número certo, sem depender só de olhar pra tela.
function somClique(){
    tocarTom(1400, 0.03, "sine", 0.12);
}

// ========================================
// NAVEGAÇÃO E TELAS
// ========================================
function trocarTela(id){
    document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
    manterSaidaAudioAcordada(id === "telaPesagem");
    let telaAlvo = document.getElementById(id);
    if(telaAlvo) {
        telaAlvo.classList.add("ativa");
    }
    // atualiza o resumo "Hoje" e a bolinha de mensagens toda vez que o
    // usuário chega no menu principal do celular, não só no login --
    // várias telas voltam direto pra cá com um simples trocarTela('telaMenu')
    if(id === "telaMenu"){
        if(typeof atualizarResumoHojeMenu === "function") atualizarResumoHojeMenu();
        if(typeof atualizarBadgeMensagens === "function") atualizarBadgeMensagens();
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
    if(typeof atualizarDashboardLoteMobile === "function") atualizarDashboardLoteMobile();
    if(typeof mostrarPatrimonio === "function") mostrarPatrimonio();
    if(typeof mostrarEvolucaoPatrimonio === "function") mostrarEvolucaoPatrimonio();
    if(typeof mostrarResultadoMensal === "function") mostrarResultadoMensal();
    if(typeof mostrarCustoPorLote === "function") mostrarCustoPorLote();
}

// o limite de compra é definido por kg/arroba -- não faz sentido comparar
// direto com um valor fixo por animal (unidades diferentes), então esse
// controle não se aplica no modo "valor fixo por animal". Parametrizado por
// sufixo pra valer também nos Critérios 2/3, não só no 1.
function validarLimiteCompraCriterio(sufixo, tipoOperacaoEl){
    let tipoPesagemEl = document.getElementById("tipoPesagem" + sufixo);
    let vKgEl = document.getElementById("valorKg" + sufixo);
    let ehValorAnimal = tipoPesagemEl && tipoPesagemEl.value === "valor_animal";
    if(tipoOperacaoEl && tipoOperacaoEl.value === "compra" && obterPapelLogado() !== "admin" && !ehValorAnimal){
        let limite = obterValorMaximoCompra();
        if(limite !== null && vKgEl){
            let valorDigitado = parseFloat(vKgEl.value.replace("R$ ", "").replace(/\./g, "").replace(",", "."));
            if(valorDigitado > limite) return false;
        }
    }
    return true;
}

function parseNumeroLocal(valor){
    let texto = String(valor || "").trim().replace(/\s/g, "").replace(/R\$/g, "");
    if(texto.includes(",")) texto = texto.replace(/\./g, "").replace(",", ".");
    let numero = Number(texto);
    return Number.isFinite(numero) ? numero : NaN;
}

// faixa de peso (De/Até kg) de um critério -- null se o operador não
// preencheu nenhum dos dois campos (critério sem faixa)
function obterFaixaPesoCriterio(sufixo){
    let minEl = document.getElementById("pesoMin" + sufixo);
    let maxEl = document.getElementById("pesoMax" + sufixo);
    let minTexto = minEl ? minEl.value.trim() : "";
    let maxTexto = maxEl ? maxEl.value.trim() : "";
    if(!minTexto && !maxTexto) return null;
    return { minimo: parseNumeroLocal(minTexto), maximo: parseNumeroLocal(maxTexto) };
}

// se algum critério aberto tem faixa de peso, TODOS precisam ter (é o que
// decide pra qual critério cada animal vai), e as faixas não podem se
// sobrepor -- senão um mesmo peso caberia em dois critérios
function validarFaixasPesoCriterios(sufixos){
    let faixas = sufixos.map(n => ({ n, faixa: obterFaixaPesoCriterio(n) }));
    if(faixas.every(f => !f.faixa)) return true;
    for(let f of faixas){
        let nome = "Critério " + (f.n || "1");
        if(!f.faixa){ alert(`Preencha a Faixa de Peso do ${nome} (quando um critério usa faixa, todos precisam usar).`); return false; }
        if(!Number.isFinite(f.faixa.minimo) || !Number.isFinite(f.faixa.maximo) || f.faixa.minimo < 0 || f.faixa.maximo <= f.faixa.minimo){
            alert(`Confira a Faixa de Peso do ${nome}: o "até" precisa ser maior que o "de".`); return false;
        }
    }
    let ordenadas = faixas.map(f => f.faixa).sort((x, y) => x.minimo - y.minimo);
    for(let i = 1; i < ordenadas.length; i++){
        if(ordenadas[i].minimo <= ordenadas[i - 1].maximo){
            alert("As Faixas de Peso dos critérios não podem se sobrepor. Ajuste os limites.");
            return false;
        }
    }
    return true;
}

function textoFaixaPeso(faixa){
    return faixa ? `${formatarPeso(faixa.minimo)}–${formatarPeso(faixa.maximo)} kg` : "";
}

// critério (índice) cuja faixa contém o peso -- -1 se nenhum
function indiceCriterioPorPeso(pesoNum){
    return criteriosPesagem.findIndex(c => c.faixaPeso && pesoNum >= c.faixaPeso.minimo && pesoNum <= c.faixaPeso.maximo);
}

function criteriosComFaixaPeso(){
    return criteriosPesagem.some(c => c.faixaPeso);
}

// usado só pra pesagens antigas salvas no modo "Preço por Faixa de Peso"
// (antes das faixas virarem critérios) -- relatórios/PDF ainda leem elas
function calcularValorFaixa(peso, faixas){
    let faixa = (faixas || []).find(f => peso >= Number(f.minimo) && peso <= Number(f.maximo));
    if(!faixa) return null;
    return { faixa, valorRS: faixa.tipo === "fixo" ? Number(faixa.valor) : peso * Number(faixa.valor) };
}

// ========================================
// SALDO DE ANIMAIS POR LOTE
// ========================================
// O servidor manda o saldo de cada lote junto da lista de lotes (compras -
// vendas + transferências recebidas - enviadas) e é a palavra final: recusa
// qualquer venda/transferência que deixe um lote negativo. Aqui no aparelho
// o saldo é usado pra IMPEDIR o erro antes -- já descontando o que foi
// lançado neste aparelho e ainda não sincronizou (funciona offline).
// null = lote sem saldo conhecido (sem lote, ou lote fora da lista).
function saldoLoteLocal(nomeLote){
    if(!nomeLote) return null;
    let lote = JSON.parse(localStorage.getItem("lotesCache") || "[]").find(l => l.nome === nomeLote);
    if(!lote || typeof lote.saldo !== "number") return null;
    let saldo = lote.saldo;
    JSON.parse(localStorage.getItem("pesagens") || "[]").forEach(r => {
        if(!r || r.sincronizado || (r.descricao || "") !== nomeLote) return;
        let n = (r.pesos || []).length;
        saldo += (r.tipo || "venda") === "compra" ? n : -n;
    });
    JSON.parse(localStorage.getItem("transferenciasPendentes") || "[]").forEach(t => {
        if(t.loteOrigem === nomeLote) saldo -= Number(t.quantidade) || 0;
        if(t.loteDestino === nomeLote) saldo += Number(t.quantidade) || 0;
    });
    return saldo;
}

function operacaoTiraAnimais(){
    let el = document.getElementById("tipoOperacao");
    let v = el ? el.value : "venda";
    return v === "venda" || v === "transferencia";
}

// quantos animais ainda dá pra lançar num critério desta pesagem (venda ou
// transferência): saldo do lote menos o que outros critérios da MESMA
// pesagem já lançaram do mesmo lote. null = sem limite.
function limiteAnimaisCriterio(indice){
    let c = criteriosPesagem[indice];
    if(!c || !operacaoTiraAnimais()) return null;
    let saldo = saldoLoteLocal(c.descricao);
    if(saldo === null) return null;
    let usadosOutros = criteriosPesagem.reduce((s, x, i) => s + (i !== indice && x.descricao === c.descricao ? x.pesos.length : 0), 0);
    return Math.max(saldo - usadosOutros, 0);
}

function saldoPermiteIniciar(){
    if(!operacaoTiraAnimais()) return true;
    for(let i = 0; i < criteriosPesagem.length; i++){
        let limite = limiteAnimaisCriterio(i);
        if(limite !== null && limite <= criteriosPesagem[i].pesos.length){
            alert(`O lote "${criteriosPesagem[i].descricao}" não tem animais no saldo pra ${ehModoTransferencia() ? "transferir" : "vender"}.`);
            return false;
        }
    }
    return true;
}

function ehModoTransferencia(){
    let el = document.getElementById("tipoOperacao");
    return !!el && el.value === "transferencia";
}

// Nova Pesagem no modo "Transferência entre lotes": não tem vendedor nem
// preço (o custo é calculado nos relatórios, ver resolverValoresTransferencias),
// só lote de origem, lote de destino e os animais pesados
function alternarModoOperacao(){
    let transf = ehModoTransferencia();
    function mostrar(id, visivel){ let el = document.getElementById(id); if(el) el.style.display = visivel ? "" : "none"; }
    mostrar("cardNomeVendedor", !transf);
    mostrar("cardTipoPesagem1", !transf);
    mostrar("cardValor1", !transf);
    mostrar("cardFaixaPeso1", !transf);
    mostrar("cardLoteDestino", transf);
    mostrar("avisoTransferencia", transf);
    mostrar("btnAdicionarCriterio2", !transf);
    let titulo = document.getElementById("tituloCriterio1");
    if(titulo) titulo.innerText = transf ? "Transferência" : "Critério 1";
    let labelLote = document.getElementById("labelLote1");
    if(labelLote) labelLote.innerText = transf ? "Lote de origem" : "Lote";
    if(transf){
        if(typeof fecharCriteriosExtras === "function") fecharCriteriosExtras();
        mostrar("btnAdicionarCriterio2", false);
        mostrar("campoRendimentoArroba", false);
        ["pesoMin", "pesoMax"].forEach(id => { let el = document.getElementById(id); if(el) el.value = ""; });
    } else {
        alternarTipoPesagem("");
    }
}

function iniciarPesagem(){
    if(ehModoTransferencia()){
        let origem = document.getElementById("descricao").value;
        let destino = document.getElementById("loteDestinoTransf").value;
        if(!origem){ alert("Escolha o lote de origem (de onde os animais saem)."); return; }
        if(!destino){ alert("Escolha o lote de destino (pra onde os animais vão)."); return; }
        if(origem === destino){ alert("O lote de origem e o de destino não podem ser o mesmo."); return; }
        let tipoPesagemEl = document.getElementById("tipoPesagem");
        if(tipoPesagemEl) tipoPesagemEl.value = "vivo";
        montarCriteriosPesagem();
        criterioAtivoIndex = 0;
        pesos = criteriosPesagem[0] ? criteriosPesagem[0].pesos : [];
        if(!saldoPermiteIniciar()) return;
        abrirTelaPesagemOuBalanca();
        return;
    }
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

    // mesma validação (valor + rendimento) pros Critérios 2/3, só se
    // o operador tiver aberto esses blocos
    for(let n of [2, 3]){
        let bloco = document.getElementById("blocoCriterio" + n);
        if(!bloco || bloco.style.display === "none") continue;
        let vKgN = document.getElementById("valorKg" + n);
        let tipoN = document.getElementById("tipoPesagem" + n);
        let rendN = document.getElementById("rendimentoArroba" + n);
        if(!vKgN || !vKgN.value.trim()){
            alert(`Preencha o valor do Critério ${n}!`);
            return;
        }
        if(tipoN && tipoN.value === "arroba" && (!rendN || !rendN.value.trim())){
            alert(`Preencha o % de rendimento da arroba do Critério ${n}!`);
            return;
        }
    }

    let tipoOperacaoEl = document.getElementById("tipoOperacao");
    for(let n of ["", "2", "3"]){
        if(n !== ""){
            let bloco = document.getElementById("blocoCriterio" + n);
            if(!bloco || bloco.style.display === "none") continue;
        }
        if(!validarLimiteCompraCriterio(n, tipoOperacaoEl)){
            alert("Valor de compra não autorizado, consulte o administrador.");
            return;
        }
    }

    let sufixosAbertos = ["", "2", "3"].filter(n => {
        if(n === "") return true;
        let bloco = document.getElementById("blocoCriterio" + n);
        return bloco && bloco.style.display !== "none";
    });
    if(!validarFaixasPesoCriterios(sufixosAbertos)) return;

    montarCriteriosPesagem();
    criterioAtivoIndex = 0;
    pesos = criteriosPesagem[0] ? criteriosPesagem[0].pesos : [];
    if(!saldoPermiteIniciar()) return;
    abrirTelaPesagemOuBalanca();
}

function abrirTelaPesagemOuBalanca(){
    if(balancaBluetoothDisponivel()){
        atualizarStatusConexaoBalanca("Balança não conectada", "");
        let botaoBalanca = document.getElementById("btnConectarBalancaTela");
        if(botaoBalanca) botaoBalanca.disabled = false;
        trocarTela("telaConectarBalanca");
    } else {
        trocarTela("telaPesagem");
        atualizarStats();
    }
}

// sufixo "" | "2" | "3" -- qual dos até 3 conjuntos de campos de critério
// (ver CRITÉRIOS DE PESAGEM mais abaixo)
function alternarTipoPesagem(sufixo){
    sufixo = sufixo || "";
    let tipoPesagemEl = document.getElementById("tipoPesagem" + sufixo);
    let rendEl = document.getElementById("rendimentoArroba" + sufixo);
    let vKgEl = document.getElementById("valorKg" + sufixo);
    if(!tipoPesagemEl || !rendEl) return;

    let tipo = tipoPesagemEl.value;
    let ehArroba = tipo === "arroba";
    let ehValorAnimal = tipo === "valor_animal";
    // esconde o CARTÃO inteiro (rótulo + campo), não só o input -- senão
    // sobrava um cartão com o rótulo "% de Rendimento" flutuando vazio
    let campoRendEl = document.getElementById("campoRendimentoArroba" + sufixo) || rendEl;
    campoRendEl.style.display = ehArroba ? "block" : "none";
    if(vKgEl) vKgEl.placeholder = ehArroba ? "Valor por Arroba (R$)" : (ehValorAnimal ? "Valor Fixo por Animal (R$)" : "Valor por kg (R$)");
}

function resetarPesagemAtual() {
    // cancela a sessão INTEIRA -- todos os critérios, não só o ativo
    criteriosPesagem = [];
    criterioAtivoIndex = 0;
    pesos = [];
    desconectarBalancaBluetooth();
    resetarEstadoCapturaBalanca();
    let labelPeso = document.getElementById("pesoAtualLabel");
    if(labelPeso){ labelPeso.textContent = "PESO ATUAL"; labelPeso.classList.remove("aoVivo"); }
    let botaoLog = document.getElementById("btnLogBalanca");
    if(botaoLog) botaoLog.style.display = "none";
    let boxLog = document.getElementById("logBalancaBox");
    if(boxLog) boxLog.style.display = "none";

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
    let destinoEl = document.getElementById("loteDestinoTransf");
    if(destinoEl) destinoEl.value = "";
    if(rendEl) rendEl.value = "";
    ["pesoMin", "pesoMax"].forEach(id => { let el = document.getElementById(id); if(el) el.value = ""; });
    alternarTipoPesagem("");
    // desfaz os critérios extras (2 e 3), se tinham sido abertos numa
    // pesagem anterior -- volta pro estado "só Critério 1" de uma sessão nova
    if(typeof fecharCriteriosExtras === "function") fecharCriteriosExtras();
    aplicarRestricoesUsuario();
    alternarModoOperacao();

    localStorage.removeItem("pesagemAtual");
    atualizarStats();
    trocarTela("telaInicial");
}

// ========================================
// MODAL CANCELAR / FINALIZAR PESAGEM (ARRASTE)
// ========================================
let acaoModalPendente = null;
// peso digitado esperando confirmação por estar fora da faixa normal
// (< 100kg ou > 999kg) -- ver adicionarPeso()/efetivarLancamentoPeso()
let pesoPendenteConfirmacao = null;

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
    pesoPendenteConfirmacao = null;
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
    } else if(acaoModalPendente === "peso_fora_padrao"){
        document.getElementById("modalConfirmarAcao").style.display = "none";
        acaoModalPendente = null;
        let peso = pesoPendenteConfirmacao;
        pesoPendenteConfirmacao = null;
        if(peso) efetivarLancamentoPeso(peso);
    }
}

// ========================================
// FLUXO DE PESAGEM
// ========================================
function adicionarPeso(){
    let inputPeso = document.getElementById("displayPeso");
    if(!inputPeso) return;

    let pesoNum = parseFloat(inputPeso.value.replace(",", "."));

    if(!pesoNum || pesoNum <= 0){
        alert("Digite um peso válido!");
        return;
    }

    // faixa normal de um animal adulto -- fora dela é bem provável que
    // tenha sido erro de digitação (ex: "45" faltando um dígito, ou "1250"
    // com um a mais), então confirma antes de lançar em vez de bloquear
    // (pode ser um peso real de bezerro/animal fora do padrão)
    if(pesoNum < 100 || pesoNum > 999){
        pesoPendenteConfirmacao = pesoNum;
        acaoModalPendente = "peso_fora_padrao";
        document.getElementById("modalAcaoTitulo").innerText = "⚠️ Peso fora do padrão";
        document.getElementById("modalAcaoTexto").innerText = `Peso fora do padrão, continuar no lançamento? (${formatarPeso(pesoNum)} kg)`;
        document.getElementById("linhaCheckboxCiente").style.display = "none";
        document.getElementById("modalConfirmarAcao").style.display = "flex";
        return;
    }

    efetivarLancamentoPeso(pesoNum);
}

function efetivarLancamentoPeso(pesoNum){
    let inputPeso = document.getElementById("displayPeso");
    let inputObs = document.getElementById("obs");
    // critérios com Faixa de Peso: o animal vai sozinho pro critério cuja
    // faixa contém o peso (troca o critério ativo antes de lançar)
    if(criteriosComFaixaPeso()){
        let indice = indiceCriterioPorPeso(pesoNum);
        if(indice < 0){
            let faixas = criteriosPesagem.map((c, i) => `Critério ${i + 1}: ${textoFaixaPeso(c.faixaPeso)}`).join("\n");
            alert(`Peso de ${formatarPeso(pesoNum)} kg não cabe em nenhuma faixa:\n${faixas}`);
            return;
        }
        if(indice !== criterioAtivoIndex) trocarCriterioAtivo(indice);
    }
    let limiteSaldo = limiteAnimaisCriterio(criterioAtivoIndex);
    if(limiteSaldo !== null && pesos.length >= limiteSaldo){
        let nomeLote = criteriosPesagem[criterioAtivoIndex].descricao;
        alert(`Saldo do lote "${nomeLote}": ${limiteSaldo} animal(is) e ${pesos.length} já lançado(s) nesta pesagem. Não dá pra ${ehModoTransferencia() ? "transferir" : "vender"} mais do que o lote tem.`);
        return;
    }
    let criterio = criteriosPesagem[criterioAtivoIndex];
    let valorRS;
    let faixaUsada = null;
    if(criterio && criterio.tipoPesagem === "faixas"){
        let calculo = calcularValorFaixa(pesoNum, criterio.faixasPreco);
        if(!calculo){ alert(`Peso de ${formatarPeso(pesoNum)} kg sem faixa de preço. Confira as faixas antes de lançar.`); return; }
        valorRS = Math.round((calculo.valorRS + Number.EPSILON) * 100) / 100;
        faixaUsada = { minimo: calculo.faixa.minimo, maximo: calculo.faixa.maximo, tipo: calculo.faixa.tipo, valor: calculo.faixa.valor };
    } else if(criterio){
        let preco = parseNumeroLocal(criterio.valorKg);
        let arrobas = criterio.tipoPesagem === "arroba" ? converterParaArroba(pesoNum, parseNumeroLocal(criterio.rendimento)) : 0;
        valorRS = criterio.tipoPesagem === "valor_animal" ? preco : (criterio.tipoPesagem === "arroba" ? arrobas : pesoNum) * preco;
        valorRS = Math.round((valorRS + Number.EPSILON) * 100) / 100;
    }

    pesos.push({
        peso: pesoNum,
        ...(Number.isFinite(valorRS) ? { valorRS } : {}),
        ...(faixaUsada ? { faixaPreco: faixaUsada } : {}),
        obs: inputObs ? inputObs.value.trim() : ""
    });

    if(typeof registrarPesoLancadoBalanca === "function") registrarPesoLancadoBalanca(pesoNum);
    bip();
    if(inputPeso) inputPeso.value = "";
    if(inputObs) inputObs.value = "";

    if(typeof salvarPesagemAuto === "function") {
        salvarPesagemAuto();
    }
    atualizarStats();
}

function excluirPesoItem(idx){
    indicePesoParaExcluir = idx;

    let textoEl = document.getElementById("confirmacaoExclusaoTexto");
    let p = pesos[idx];
    if(textoEl && p){
        let vKgEl = document.getElementById("valorKg");
        let valorKgNum = parseFloat((vKgEl ? vKgEl.value : "0").replace("R$ ", "").replace(/\./g, "").replace(",", ".")) || 0;
        let tipoPesagemEl = document.getElementById("tipoPesagem");
        let tipo = tipoPesagemEl ? tipoPesagemEl.value : "vivo";
        let ehArroba = tipo === "arroba";
        let ehValorAnimal = tipo === "valor_animal";
        let rendEl = document.getElementById("rendimentoArroba");
        let rendimentoNum = rendEl ? (parseFloat(rendEl.value.replace(",", ".")) || 0) : 0;
        let arrobaItem = converterParaArroba(p.peso, rendimentoNum);
        let valorItem = Number.isFinite(Number(p.valorRS)) ? Number(p.valorRS) : (ehValorAnimal ? valorKgNum : ((ehArroba ? arrobaItem : p.peso) * valorKgNum));
        let numero = String(idx + 1).padStart(2, "0");
        textoEl.innerText = `Deseja excluir esta pesagem "${numero} - ${formatarPeso(p.peso)}kg - R$ ${formatarMoeda(valorItem)}"?`;
    } else if(textoEl){
        textoEl.innerText = "Deseja excluir esta pesagem?";
    }

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

// os animais pesados viram UMA transferência (fila local, enviada pela
// sincronização -- funciona offline igual às pesagens)
function finalizarTransferenciaPesada(){
    if(criteriosPesagem[criterioAtivoIndex]) criteriosPesagem[criterioAtivoIndex].pesos = pesos;
    if(pesos.length === 0){ alert("Nenhum peso lançado!"); return; }
    let origem = document.getElementById("descricao").value;
    let destino = document.getElementById("loteDestinoTransf").value;
    let kgTotal = pesos.reduce((s, p) => s + (Number(p.peso) || 0), 0);
    let transferencia = {
        id: crypto.randomUUID(),
        loteOrigem: origem,
        loteDestino: destino,
        quantidade: pesos.length,
        pesos: pesos.map(p => ({ peso: p.peso, obs: p.obs || "" })),
        kgTotal: Math.round(kgTotal * 100) / 100,
        modoCusto: "automatico",
        data: new Date().toLocaleString("pt-BR")
    };
    let fila = JSON.parse(localStorage.getItem("transferenciasPendentes") || "[]");
    fila.push(transferencia);
    localStorage.setItem("transferenciasPendentes", JSON.stringify(fila));
    localStorage.removeItem("pesagemAtual");

    criteriosPesagem = [];
    criterioAtivoIndex = 0;
    pesos = [];
    desconectarBalancaBluetooth();
    resetarEstadoCapturaBalanca();
    alert(`Transferência registrada: ${transferencia.quantidade} animal(is), ${formatarPeso(transferencia.kgTotal)} kg, de "${origem}" para "${destino}".`);
    atualizarStats();
    trocarTela("telaMenu");
    sincronizarAgora();
}

function finalizarPesagem(){
    if(ehModoTransferencia()){ finalizarTransferenciaPesada(); return; }
    // garante que o array do critério ativo está com o `pesos` mais recente
    // antes de checar/salvar (já é a mesma referência, isso é só defensivo)
    if(criteriosPesagem[criterioAtivoIndex]) criteriosPesagem[criterioAtivoIndex].pesos = pesos;
    let criteriosUsados = criteriosPesagem.filter(c => c.pesos.length > 0);
    if(criteriosUsados.length === 0){
        alert("Nenhum peso lançado!");
        return;
    }

    // se mais de 1 critério foi usado, marca todas as pesagens dessa
    // finalização com o mesmo sessaoId -- é o que deixa o relatório de
    // impressão/WhatsApp juntar tudo num recibo só depois (ver
    // obterRegistrosDaSessao). Com só 1 critério (o caso comum) fica null,
    // sem efeito nenhum -- continua exatamente como sempre foi.
    sessaoPesagemIdAtual = criteriosUsados.length > 1 ? crypto.randomUUID() : null;
    let tipoOperacaoFinal = (document.getElementById("tipoOperacao") || {}).value || "venda";
    let compraParaFrete = tipoOperacaoFinal === "compra" ? {
        vendedor: (document.getElementById("nomeVendedor") || {}).value || "",
        lotes: criteriosUsados.map(c => ({ lote: c.descricao || "", animais: c.pesos.length }))
    } : null;

    // cada critério com pelo menos 1 peso vira uma pesagem salva separada
    // (mesmo formato de sempre) -- salvarPesagem() não muda, só roda uma
    // vez por critério que tiver algo lançado
    let idsPesagensSalvas = [];
    criteriosPesagem.forEach((c, i) => {
        if(c.pesos.length === 0) return;
        trocarCriterioAtivo(i);
        if(typeof salvarPesagem === "function") salvarPesagem();
        let salvas = JSON.parse(localStorage.getItem("pesagens") || "[]");
        idsPesagensSalvas.push(salvas.length ? salvas[salvas.length - 1].id : null);
    });
    if(compraParaFrete) compraParaFrete.lotes.forEach((l, k) => { l.pesagemId = idsPesagensSalvas[k] || null; });
    // devolve os campos do Critério 1 pro que o operador configurou -- o
    // loop acima deixou neles os valores do último critério salvo
    if(criteriosPesagem.length > 1) trocarCriterioAtivo(0);
    sessaoPesagemIdAtual = null;

    criteriosPesagem = [];
    criterioAtivoIndex = 0;
    pesos = [];
    // sem isso, um Critério 2/3 aberto nessa sessão continuava aparecendo
    // aberto (e contando como critério de verdade) em TODAS as próximas
    // pesagens, mesmo sem o operador pedir de novo -- era o bug reportado
    if(typeof fecharCriteriosExtras === "function") fecharCriteriosExtras();
    desconectarBalancaBluetooth();
    resetarEstadoCapturaBalanca();
    let labelPeso = document.getElementById("pesoAtualLabel");
    if(labelPeso){ labelPeso.textContent = "PESO ATUAL"; labelPeso.classList.remove("aoVivo"); }
    let botaoLog = document.getElementById("btnLogBalanca");
    if(botaoLog) botaoLog.style.display = "none";
    let boxLog = document.getElementById("logBalancaBox");
    if(boxLog) boxLog.style.display = "none";
    relatorios = JSON.parse(localStorage.getItem("pesagens") || "[]");

    if(compraParaFrete){
        // a pergunta aparece já em cima dos Relatórios (atrás dela não fica
        // mais a tela de pesagem com os números da compra que acabou)
        abrirRelatorios();
        abrirPerguntaFrete(compraParaFrete);
        return;
    }
    alert("Pesagem salva com sucesso!");
    abrirRelatorios();
}

// ========================================
// FRETE DA COMPRA
// ========================================
// Ao finalizar uma compra: "Teve despesa com frete?". Se sim, o valor vira
// uma despesa PAGA no Fluxo de Caixa (categoria Frete), no lote da compra --
// entra no Custo por Lote. Compra com mais de um lote na mesma pesagem
// (critérios): o frete é dividido pelo número de animais de cada lote.
// Fica numa fila no aparelho e sobe na sincronização (funciona offline).
let compraFreteAtual = null;

function abrirPerguntaFrete(compra){
    compraFreteAtual = compra;
    document.getElementById("freteEtapaPergunta").style.display = "";
    document.getElementById("freteEtapaValor").style.display = "none";
    document.getElementById("freteValor").value = "";
    document.getElementById("freteObs").value = "";
    document.getElementById("freteErro").style.display = "none";
    document.getElementById("freteDivisao").innerHTML = "";
    document.getElementById("modalFrete").style.display = "flex";
}

function responderFrete(teve){
    if(!teve){ concluirFrete(); return; }
    document.getElementById("freteEtapaPergunta").style.display = "none";
    document.getElementById("freteEtapaValor").style.display = "";
    atualizarDivisaoFrete();
    document.getElementById("freteValor").focus();
}

function formatarCampoMoedaFrete(input){
    let numero = Number(input.value.replace(/\D/g, "")) / 100;
    input.value = numero === 0 ? "" : "R$ " + formatarMoeda(numero);
    atualizarDivisaoFrete();
}

// divide em centavos pelo nº de animais; a sobra de arredondamento fica
// no último lote, pra soma bater exatamente com o valor digitado
function dividirFretePorLote(valor, lotes){
    let totalAnimais = lotes.reduce((s, l) => s + l.animais, 0) || 1;
    let centavos = Math.round(valor * 100), usados = 0;
    return lotes.map((l, i) => {
        let parte = i === lotes.length - 1 ? centavos - usados : Math.round(centavos * l.animais / totalAnimais);
        usados += parte;
        return { lote: l.lote, animais: l.animais, pesagemId: l.pesagemId || null, valor: parte / 100 };
    });
}

function atualizarDivisaoFrete(){
    let el = document.getElementById("freteDivisao");
    if(!compraFreteAtual || !el) return;
    let valor = lerNumeroSimulador(document.getElementById("freteValor").value);
    let lotes = compraFreteAtual.lotes;
    if(lotes.length === 1){
        el.innerHTML = `Lote: <b>${escaparHtmlPesagem(lotes[0].lote || "Sem lote")}</b>`;
        return;
    }
    el.innerHTML = "Dividido pelos animais de cada lote:<br>" + dividirFretePorLote(valor, lotes)
        .map(p => `• ${escaparHtmlPesagem(p.lote || "Sem lote")} (${p.animais} anim.): <b>R$ ${formatarMoeda(p.valor)}</b>`).join("<br>");
}

function salvarFrete(){
    let valor = lerNumeroSimulador(document.getElementById("freteValor").value);
    let erro = document.getElementById("freteErro");
    if(!(valor > 0)){ erro.innerText = "Digite o valor do frete."; erro.style.display = "block"; return; }
    let obs = document.getElementById("freteObs").value.trim();
    let compra = compraFreteAtual;
    let totalAnimais = compra.lotes.reduce((s, l) => s + l.animais, 0);
    let data = new Date().toLocaleString("pt-BR");
    let fila = JSON.parse(localStorage.getItem("despesasFretePendentes") || "[]");
    dividirFretePorLote(valor, compra.lotes).forEach(p => {
        if(p.valor <= 0) return;
        let descricao = "Frete da compra" + (compra.vendedor ? " — " + compra.vendedor : "")
            + (compra.lotes.length > 1 ? ` (${p.animais} de ${totalAnimais} animais)` : "")
            + (obs ? " — " + obs : "");
        fila.push({ id: crypto.randomUUID(), valor: p.valor, loteNome: p.lote || null, descricao, data, pesagemId: p.pesagemId });
    });
    localStorage.setItem("despesasFretePendentes", JSON.stringify(fila));
    concluirFrete(`Frete de R$ ${formatarMoeda(valor)} lançado como pago.`);
}

function concluirFrete(mensagemExtra){
    document.getElementById("modalFrete").style.display = "none";
    compraFreteAtual = null;
    if(typeof mensagemExtra === "string") alert("Pesagem salva com sucesso!\n" + mensagemExtra);
    sincronizarAgora();
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

// valor dentro de onclick='fn(...)': JSON.stringify sozinho deixava um
// apóstrofo no texto (ex: brinco "07'A", nome "D'Ávila") fechar o atributo
// e quebrar o botão -- ou virar código. O navegador desfaz as entidades
// antes de rodar o onclick, então o valor chega certinho na função.
function jsonAtributo(valor){
    return escaparHtmlPesagem(JSON.stringify(valor === undefined ? null : valor));
}

function escaparHtmlPesagem(texto){
    return String(texto).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// diminui a letra do valor só quando ele não cabe no cartão (ex: total
// de um lote grande, "R$ 1.234.567,00") -- nunca corta o número
function ajustarFonteStats(){
    document.querySelectorAll("#telaPesagem .statValor").forEach(el => {
        el.style.fontSize = "";
        if(!el.clientWidth) return;
        let tamanho = parseFloat(getComputedStyle(el).fontSize);
        while(el.scrollWidth > el.clientWidth && tamanho > 10){
            tamanho -= 1;
            el.style.fontSize = tamanho + "px";
        }
    });
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
    let tipoPesagemValor = tipoPesagemEl ? tipoPesagemEl.value : "vivo";
    let ehArroba = tipoPesagemValor === "arroba";
    let ehValorAnimal = tipoPesagemValor === "valor_animal";
    let ehFaixas = tipoPesagemValor === "faixas";
    let rendEl = document.getElementById("rendimentoArroba");
    let rendimentoNum = rendEl ? (parseFloat(rendEl.value.replace(",", ".")) || 0) : 0;

    let ultimoArroba = converterParaArroba(ultimo, rendimentoNum);
    let totalArroba = converterParaArroba(total, rendimentoNum);
    let mediaArroba = qtd > 0 ? (totalArroba / qtd) : 0;

    // valor_animal: preço combinado por cabeça, não por peso -- cada animal
    // vale o mesmo valor fixo, e o total é cabeças × valor fixo.
    let calcularValorAtual = p => Number.isFinite(Number(p.valorRS)) ? Number(p.valorRS) : (ehValorAnimal ? valorKgNum : ((ehArroba ? converterParaArroba(p.peso, rendimentoNum) : p.peso) * valorKgNum));
    let ultimoValor = qtd ? calcularValorAtual(pesos[qtd - 1]) : 0;
    let totalValor = pesos.reduce((s,p) => s + calcularValorAtual(p), 0);
    let kgImplicito = total > 0 ? (totalValor / total) : 0;

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
    let cardValorAnimalEl = document.getElementById("cardValorAnimal");
    let cardKgImplicitoEl = document.getElementById("cardKgImplicito");
    let totalArrobaEl = document.getElementById("totalArroba");
    let mediaArrobaEl = document.getElementById("mediaArroba");
    let valorAnimalFixoEl = document.getElementById("valorAnimalFixo");
    let kgImplicitoEl = document.getElementById("kgImplicito");

    // unidade (kg/R$/@) em letra menor -- deixa o número caber nos cartões
    // de 3 colunas sem perder destaque
    let comKg = n => `${n}<small>kg</small>`;
    let comRS = n => `<small>R$</small>${formatarMoeda(n)}`;
    let comArroba = n => `${n.toFixed(2).replace(".", ",")}<small>@</small>`;
    if(qtdEl){
        let limiteSaldo = typeof limiteAnimaisCriterio === "function" ? limiteAnimaisCriterio(criterioAtivoIndex) : null;
        if(limiteSaldo !== null) qtdEl.innerHTML = `${qtd}<small>/${limiteSaldo}</small>`;
        else qtdEl.innerText = qtd;
    }
    if(medEl) medEl.innerHTML = comKg(media.toFixed(2).replace(".", ","));
    if(totEl) totEl.innerHTML = comKg(formatarPeso(total));
    // esse cartão (id cardUltimoKg) só aparece no critério "peso vivo (kg)"
    // -- em vez do peso do último animal (já visível na lista logo abaixo),
    // mostra o valor/kg configurado, pra lembrar o operador do preço em uso
    if(ultEl) ultEl.innerHTML = comRS(valorKgNum);
    if(uValEl) uValEl.innerHTML = comRS(ultimoValor);
    if(tValEl) tValEl.innerHTML = comRS(totalValor);

    if(cardUltimoKgEl) cardUltimoKgEl.style.display = (ehArroba || ehValorAnimal || ehFaixas) ? "none" : "block";
    if(cardUltimoValorEl) cardUltimoValorEl.style.display = (ehArroba || ehValorAnimal) ? "none" : "block";
    if(cardTotalArrobaEl) cardTotalArrobaEl.style.display = ehArroba ? "block" : "none";
    if(cardMediaArrobaEl) cardMediaArrobaEl.style.display = ehArroba ? "block" : "none";
    if(cardValorAnimalEl) cardValorAnimalEl.style.display = ehValorAnimal ? "block" : "none";
    if(cardKgImplicitoEl) cardKgImplicitoEl.style.display = (ehValorAnimal || ehFaixas) ? "block" : "none";
    if(totalArrobaEl) totalArrobaEl.innerHTML = comArroba(totalArroba);
    if(mediaArrobaEl) mediaArrobaEl.innerHTML = comArroba(mediaArroba);
    if(valorAnimalFixoEl) valorAnimalFixoEl.innerHTML = comRS(valorKgNum);
    if(kgImplicitoEl) kgImplicitoEl.innerHTML = comRS(kgImplicito);
    ajustarFonteStats();
    let qtdRegistrosEl = document.getElementById("pesosRecentesQtd");
    if(qtdRegistrosEl) qtdRegistrosEl.innerText = qtd === 1 ? "1 registro" : qtd + " registros";

    let listaHTML = "";
    if(pesos.length === 0){
        listaHTML = `<div class="listaPesosAtualVazia">Nenhum peso lançado ainda</div>`;
    } else {
        [...pesos].reverse().forEach((p, idx) => {
            let originalIdx = pesos.length - 1 - idx;
            let arrobaItem = converterParaArroba(p.peso, rendimentoNum);
            let valorItem = calcularValorAtual(p);
            let extras = [];
            if(ehArroba) extras.push(`${arrobaItem.toFixed(2).replace(".", ",")} @`);
            if(ehValorAnimal && p.peso > 0) extras.push(`R$ ${formatarMoeda(valorKgNum / p.peso)}/kg`);
            if(p.obs) extras.push(escaparHtmlPesagem(p.obs));
            listaHTML += `
                <div class="itemPesagem">
                    <span class="itemPesagemNum">#${originalIdx + 1}</span>
                    <span class="itemPesagemPeso"><b>${formatarPeso(p.peso)}</b> kg${extras.length ? `<small>${extras.join(" · ")}</small>` : ""}</span>
                    <span class="itemPesagemDireita">
                        <span class="itemPesagemValor">R$ ${formatarMoeda(valorItem)}</span>
                        <button class="btnExcluirItem" onclick="excluirPesoItem(${originalIdx})" aria-label="Excluir peso">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 14h10l1-14"></path><path d="M10 10v6M14 10v6"></path></svg>
                        </button>
                    </span>
                </div>
            `;
        });
    }

    let containerLista = document.getElementById("listaPesosAtual");
    if(containerLista) containerLista.innerHTML = listaHTML;

    if(typeof atualizarBotoesCriteriosPesagem === "function") atualizarBotoesCriteriosPesagem();
}

// ========================================
// CRITÉRIOS DE PESAGEM -- até 3 conjuntos de tipo/valor/rendimento/lote
// configurados em telaInicial (pro caso de um mesmo vendedor entregar
// grupos de animais diferentes, ex: 10 bezerros Nelore + 5 comuns, cada
// grupo com preço/lote próprio). Na tela de Pesagem, os 3 botões trocam
// qual critério está ATIVO -- cada peso lançado vai pro array daquele
// critério, e trocar de critério NÃO mexe nos pesos já lançados nos
// outros. Ao finalizar, cada critério com pelo menos 1 peso vira uma
// pesagem salva separada (mesmo formato de sempre -- ver finalizarPesagem
// em app.js e salvarPesagem em db.js), então nenhuma função de relatório/
// PDF/WhatsApp/Custo por Lote precisa saber que isso existe.
//
// O truque: `pesos` é sempre uma REFERÊNCIA a criteriosPesagem[i].pesos --
// trocar de critério só troca pra qual array `pesos` aponta, então
// adicionarPeso()/atualizarStats()/digitar() etc. continuam funcionando
// exatamente como já funcionavam, sem precisar saber que critérios existem.
// ========================================
let criteriosPesagem = [];
let criterioAtivoIndex = 0;
// setado só durante finalizarPesagem() enquanto salva várias pesagens da
// mesma sessão (ver db.js salvarPesagem()) -- fora disso é sempre null
let sessaoPesagemIdAtual = null;

function montarCriteriosPesagem(){
    // preserva pesos já lançados (ex: restaurados de uma queda do app antes
    // do operador apertar "Iniciar Pesagem" de novo) -- sem isso, reabrir a
    // pesagem depois de restaurar um rascunho apagaria tudo que já tinha
    let anteriores = criteriosPesagem;
    criteriosPesagem = [];
    let indice = 0;
    for(let n of ["", "2", "3"]){
        let tipoEl = document.getElementById("tipoPesagem" + n);
        let valorEl = document.getElementById("valorKg" + n);
        if(!tipoEl || !valorEl) continue;
        // Critério 1 sempre entra; 2/3 só se o bloco estiver visível (foi aberto)
        if(n !== ""){
            let bloco = document.getElementById("blocoCriterio" + n);
            if(!bloco || bloco.style.display === "none") continue;
        }
        let rendEl = document.getElementById("rendimentoArroba" + n);
        let loteEl = document.getElementById("descricao" + n);
        let pesosExistentes = (anteriores[indice] && anteriores[indice].pesos) || [];
        criteriosPesagem.push({
            tipoPesagem: tipoEl.value,
            valorKg: valorEl.value,
            rendimento: rendEl ? rendEl.value : "",
            descricao: loteEl ? loteEl.value : "",
            faixaPeso: obterFaixaPesoCriterio(n),
            pesos: pesosExistentes
        });
        indice++;
    }
}

function rotuloCriterio(criterio, indice){
    if(criterio.descricao) return criterio.descricao;
    return "Critério " + (indice + 1);
}

function atualizarBotoesCriteriosPesagem(){
    let linha = document.getElementById("criteriosPesagemLinha");
    if(!linha) return;
    if(criteriosPesagem.length <= 1){
        linha.style.display = "none";
        return;
    }
    linha.style.display = "grid";
    linha.innerHTML = criteriosPesagem.map((c, i) => `
        <button class="criterioBtn${i === criterioAtivoIndex ? " criterioBtnAtivo" : ""}" onclick="trocarCriterioAtivo(${i})">
            <span class="criterioBtnLabel">Critério ${i + 1}${c.faixaPeso ? " · " + textoFaixaPeso(c.faixaPeso) : ""}</span>
            <span class="criterioBtnValor">${rotuloCriterio(c, i)}</span>
        </button>
    `).join("");
}

// troca qual critério está ativo -- grava o que estiver no `pesos` atual de
// volta no critério que está saindo (por segurança, embora já seja a mesma
// referência), troca `pesos` pra apontar pro array do novo critério ativo,
// e escreve os campos desse critério de volta em #tipoPesagem/#valorKg/
// #rendimentoArroba/#descricao -- é de lá que atualizarStats() já lê hoje.
function trocarCriterioAtivo(indice){
    if(!criteriosPesagem[indice]) return;
    criteriosPesagem[criterioAtivoIndex].pesos = pesos;
    criterioAtivoIndex = indice;
    let c = criteriosPesagem[indice];
    pesos = c.pesos;

    let tipoEl = document.getElementById("tipoPesagem");
    let valorEl = document.getElementById("valorKg");
    let rendEl = document.getElementById("rendimentoArroba");
    let loteEl = document.getElementById("descricao");
    if(tipoEl) tipoEl.value = c.tipoPesagem;
    if(valorEl) valorEl.value = c.valorKg;
    if(rendEl) rendEl.value = c.rendimento;
    if(loteEl) loteEl.value = c.descricao;

    if(typeof alternarTipoPesagem === "function") alternarTipoPesagem("");
    if(typeof atualizarStats === "function") atualizarStats();
}

function mostrarCriterioExtra(n){
    let bloco = document.getElementById("blocoCriterio" + n);
    let botao = document.getElementById("btnAdicionarCriterio" + n);
    if(bloco) bloco.style.display = "block";
    if(botao) botao.style.display = "none";
    // abrir o Critério 2 tem que trazer de volta a opção de abrir o
    // Critério 3 (que mora dentro do bloco do 2, mais abaixo) -- sem isso,
    // depois que o Critério 2 tivesse sido removido/resetado uma vez (o que
    // deixa o botão "+ Adicionar Critério 3" em display:none pra fechar o 3
    // junto), reabrir o Critério 2 nunca devolvia esse botão, então só dava
    // pra configurar 2 critérios, nunca 3
    if(n === 2){
        let bloco3 = document.getElementById("blocoCriterio3");
        let btn3 = document.getElementById("btnAdicionarCriterio3");
        if(btn3 && (!bloco3 || bloco3.style.display !== "block")) btn3.style.display = "block";
    }
    carregarLotesSelect();
}

function removerCriterioExtra(n){
    let bloco = document.getElementById("blocoCriterio" + n);
    if(bloco) bloco.style.display = "none";
    ["tipoPesagem", "rendimentoArroba", "valorKg", "descricao", "pesoMin", "pesoMax"].forEach(base => {
        let el = document.getElementById(base + n);
        if(el) el.value = base === "tipoPesagem" ? "vivo" : "";
    });
    let campoRend = document.getElementById("campoRendimentoArroba" + n);
    if(campoRend) campoRend.style.display = "none";
    // Critério 3 mora dentro do bloco do Critério 2 -- remover o 2 leva o 3 junto
    if(n === 2){
        let bloco3 = document.getElementById("blocoCriterio3");
        if(bloco3) bloco3.style.display = "none";
        let btn3 = document.getElementById("btnAdicionarCriterio3");
        if(btn3) btn3.style.display = "none";
    }
    let botaoAdicionar = document.getElementById("btnAdicionarCriterio" + n);
    if(botaoAdicionar) botaoAdicionar.style.display = "block";
}

// fecha os blocos de Critério 2/3 se tiverem ficado abertos de uma pesagem
// anterior -- sem isso, uma vez que o operador abrisse o Critério 2 numa
// pesagem, ele continuava aparecendo aberto (e contando como um critério
// de verdade em montarCriteriosPesagem) em TODAS as pesagens seguintes,
// mesmo sem o operador pedir. Chamado ao entrar em Nova Pesagem e depois
// de cancelar/finalizar, pra garantir sempre um estado limpo.
function fecharCriteriosExtras(){
    removerCriterioExtra(3);
    removerCriterioExtra(2);
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
        container.innerHTML = "<p style='text-align:center; padding:20px; color:#a6b0c6;'>Nenhum relatório salvo.</p>";
        return;
    }

    // agrupa por sessaoId -- pesagens da mesma sessão (2-3 critérios
    // lançados de uma vez) aparecem como UM cartão só na lista, não um por
    // lote. O rádio desse cartão aponta pro primeiro registro do grupo;
    // gerarPDF()/prepararImpressao()/compartilharWhatsApp() já expandem
    // pra sessão inteira sozinhos via obterRegistrosDaSessao(). Registros
    // sem sessaoId (a maioria) formam grupo de 1 cada, igual sempre foi.
    let grupos = [];
    let porChave = new Map();
    itens.forEach(item => {
        let chave = item.r.sessaoId || ("solo-" + item.originalIndex);
        if(porChave.has(chave)){
            porChave.get(chave).push(item);
        } else {
            let grupo = [item];
            porChave.set(chave, grupo);
            grupos.push(grupo);
        }
    });

    let html = "";
    [...grupos].reverse().forEach(grupo => {
        let primeiro = grupo[0].r;
        let originalIndex = grupo[0].originalIndex;
        let multiplos = grupo.length > 1;

        let totalAnimais = grupo.reduce((s, item) => s + (item.r.pesos ? item.r.pesos.length : 0), 0);
        let totalKgGrupo = grupo.reduce((s, item) => s + (item.r.pesos ? item.r.pesos.reduce((a, b) => a + (b.peso || 0), 0) : 0), 0);
        let tipo = primeiro.tipo || "venda";
        let tagTipo = tipo === "compra"
            ? `<span class="tagTipo tagTipoCompra">COMPRA</span>`
            : `<span class="tagTipo tagTipoVenda">VENDA</span>`;

        let numeroTexto = primeiro.numero ? ("Nº " + primeiro.numero) : "Pendente";
        let tagLotes = multiplos ? `<span class="tagTipo" style="background:#5e35b1">${grupo.length} LOTES</span>` : "";
        let lotesTexto = multiplos
            ? grupo.map(item => item.r.descricao || "Sem descrição").join(", ")
            : (primeiro.descricao || "Sem descrição");

        html += `
            <div class="cardRelatorio">
                <label>
                    <input type="radio" name="relatorioSelecionado" value="${originalIndex}" data-id="${escaparHtmlPesagem(primeiro.id || "")}">
                    <div class="infoRelatorio">
                        ${tagTipo} <span class="numeroRelatorio">${numeroTexto}</span> ${tagLotes}<br>
                        <b>Vendedor:</b> ${escaparHtmlPesagem(primeiro.vendedor || "Não informado")}<br>
                        <b>${multiplos ? "Lotes" : "Lote/Descrição"}:</b> ${escaparHtmlPesagem(lotesTexto)}<br>
                        <b>Data:</b> ${escaparHtmlPesagem(primeiro.data || "Sem data")}<br>
                        ${primeiro.criadoPor ? `<b>Lançado por:</b> ${escaparHtmlPesagem(primeiro.criadoPor)}<br>` : ""}
                        <b>Animais:</b> ${totalAnimais} | <b>Total:</b> ${formatarPeso(totalKgGrupo)} kg
                    </div>
                </label>
            </div>
        `;
    });
    // a lista é redesenhada a cada sincronização automática (no computador,
    // a cada 60s) -- sem isso a seleção e o filtro da pesquisa sumiam no meio
    // do uso (selecionava, ia clicar em Imprimir e não tinha mais nada marcado)
    let marcadoAntes = document.querySelector("input[name='relatorioSelecionado']:checked");
    let idMarcado = marcadoAntes ? marcadoAntes.dataset.id : null;
    container.innerHTML = html;
    if(idMarcado){
        let radio = [...container.querySelectorAll("input[name='relatorioSelecionado']")].find(r => r.dataset.id === idMarcado);
        if(radio) radio.checked = true;
    }
    let buscaEl = document.getElementById("buscarVendedor");
    if(buscaEl && buscaEl.value) filtrarRelatorios();
    atualizarSelecaoRelatorio();
}

// cartão marcado em destaque + resumo do selecionado no topo (computador)
function atualizarSelecaoRelatorio() {
    let sel = document.querySelector("input[name='relatorioSelecionado']:checked");
    document.querySelectorAll(".cardRelatorio").forEach(card => card.classList.toggle("cardRelatorioSelecionado", !!sel && card.contains(sel)));
    let info = document.getElementById("relatorioSelecionadoInfo");
    let topo = document.querySelector(".relatoriosTopo");
    if(topo) topo.classList.toggle("semSelecao", !sel);
    if(!info) return;
    let r = sel ? relatorios[sel.value] : null;
    if(!r){ info.textContent = "Selecione um relatório na lista"; return; }
    let tipo = (r.tipo || "venda") === "compra" ? "Compra" : "Venda";
    info.innerHTML = `Selecionado: <b>${tipo}${r.numero ? " nº " + r.numero : ""}</b> · ${escaparHtmlPesagem(r.vendedor || "Sem vendedor")} · ${escaparHtmlPesagem(r.descricao || "Sem lote")}`;
}
document.addEventListener("change", e => {
    if(e.target && e.target.name === "relatorioSelecionado") atualizarSelecaoRelatorio();
});

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
    // conta REGISTROS de compra (cada relatório é uma compra independente,
    // não importa quantos animais tinha dentro) -- diferente de
    // animaisComprados, que soma cabeças
    let comprasFeitas = 0;

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
            comprasFeitas++;
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
    set("dashComprasFeitas", comprasFeitas);

    // cartões extras e comparativo Compra x Venda (só existem na tela de gerenciamento)
    let elSaldo = document.getElementById("dashSaldo");
    if(elSaldo){
        let positivo = saldo >= 0;
        elSaldo.innerText = (positivo ? "▲ R$ " : "▼ R$ ") + formatarMoeda(Math.abs(saldo));
        // o número fica branco; quem muda é o cartão (verde lucro / vermelho prejuízo)
        let cartaoSaldo = elSaldo.closest(".kpiCard");
        if(cartaoSaldo){
            cartaoSaldo.classList.toggle("kpiSaldoPositivo", positivo);
            cartaoSaldo.classList.toggle("kpiSaldoNegativo", !positivo);
        }
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

// ========================================
// DASHBOARD POR LOTE + SIMULADOR DE VENDA (celular) -- filtro detalhado com
// o mesmo "Custo por Lote" completo que já existe no desktop (compra +
// insumos de estoque + lançamentos avulsos do caixa + transferências entre
// lotes), não só a soma simples de compra/venda que mostrarDashboard() já
// faz. As 3 rotas de onde vem parte desse custo (estoque-saidas,
// caixa-lancamentos, transferencias-lotes) são admin-only no servidor e
// devolvem a base inteira sem filtro por usuário -- por isso essa seção só
// aparece logado como admin (ver atualizarDashboardLoteMobile).
let estoqueSaidasCacheMobile = [];
let caixaLancamentosCacheMobile = [];
let transferenciasLotesCacheMobile = [];
// sempre busca de novo (nada de cache "só na primeira vez") -- um insumo,
// lançamento de caixa ou transferência registrado depois da primeira
// abertura do Dashboard só ia aparecer no Custo por Lote do celular depois
// de recarregar a página inteira, enquanto o desktop sempre mostrava os
// dados frescos (mesmo lote, números diferentes entre os dois na mesma
// sessão até o celular ser recarregado).
async function carregarDadosCustoLoteMobile(){
    if(obterPapelLogado() !== "admin") return;
    let token = obterToken();
    if(!token) return;
    try{
        let headers = { "Authorization": "Bearer " + token };
        let [respSaidas, respCaixa, respTransf] = await Promise.all([
            fetch(`${API_URL}/api/estoque-saidas`, { headers }),
            fetch(`${API_URL}/api/caixa-lancamentos`, { headers }),
            fetch(`${API_URL}/api/transferencias-lotes`, { headers })
        ]);
        if(respSaidas.ok) estoqueSaidasCacheMobile = await respSaidas.json();
        if(respCaixa.ok) caixaLancamentosCacheMobile = await respCaixa.json();
        if(respTransf.ok) transferenciasLotesCacheMobile = await respTransf.json();
        carregarDadosCustoLoteMobileResolvido();
    } catch(e){
        // seção só informativa -- se a rede falhar, o resto do Dashboard continua normal
    }
}

// ========================================
// CUSTO DAS TRANSFERÊNCIAS ENTRE LOTES
// ========================================
// Regra (pedida pelo Herlon): os animais transferidos levam só o custo que o
// lote de origem AINDA NÃO RECUPEROU, dividido pelos animais que restam nele.
// Ex: comprou 10 por R$1.000 (R$10.000) e vendeu 9:
//   - por R$1.200 cada (R$10.800): já recuperou tudo e lucrou R$800 -> o que
//     sobra vai com custo R$0 e o lucro de R$800 FICA no lote de origem;
//   - por R$1.100 cada (R$9.900): faltam R$100 -> o que sobra vai com R$100.
// Antes ia o "custo médio" (custo restante ÷ animais), que fica NEGATIVO
// quando o lote já deu lucro -- a transferência levava o lucro embora.
// Transferências registradas com modoCusto "automatico" têm o valor
// calculado aqui, na hora de cada relatório, olhando tudo que aconteceu no
// lote de origem até o momento da transferência (então um gasto ou venda
// lançado depois, com data anterior, já entra certo). As antigas (manual)
// continuam com o valor que foi gravado.
function resolverValoresTransferencias(transferencias, pesagens, saidas, lancamentos){
    if(!Array.isArray(transferencias)) return;
    let automaticas = transferencias.filter(t => t.modoCusto === "automatico");
    if(automaticas.length === 0) return;
    let chave = chaveOrdenacaoLoteMobile;
    automaticas.forEach(t => { t._pendente = true; t.valorTotal = 0; t.custoUnitario = 0; });
    [...automaticas]
        .sort((a, b) => (chave(a.data) || "").localeCompare(chave(b.data) || ""))
        .forEach(t => {
            let limite = chave(t.data) || "9999";
            let est = estadoLoteAteTransferencia(t.loteOrigem, limite, t, transferencias, pesagens || [], saidas || [], lancamentos || []);
            let restante = est.gasto - est.receita;
            let qtd = Math.min(Number(t.quantidade) || 0, est.headcount);
            t.valorTotal = (est.headcount > 0 && restante > 0) ? Math.round(restante * qtd / est.headcount * 100) / 100 : 0;
            t.custoUnitario = t.quantidade > 0 ? t.valorTotal / t.quantidade : 0;
            t.custoRestanteOrigem = restante;
            t.headcountOrigem = est.headcount;
            delete t._pendente;
        });
}

// como estava o lote de origem logo antes da transferência: só o ciclo
// atual dele (mesma regra de calcularInicioCicloLote -- lote que zerou e
// recebeu animais de novo começa do zero)
function estadoLoteAteTransferencia(nomeLote, limite, atual, transferencias, pesagens, saidas, lancamentos){
    let chave = chaveOrdenacaoLoteMobile;
    let eventos = [];
    pesagens.forEach(r => {
        if((r.descricao || "Sem descrição") !== nomeLote) return;
        let o = chave(r.data);
        if(!o || o > limite) return;
        let d = calcularDadosCompletos(r);
        let ehCompra = (r.tipo || "venda") === "compra";
        eventos.push({ o, delta: ehCompra ? d.totalAnimais : -d.totalAnimais, gasto: ehCompra ? d.totalRS : 0, receita: ehCompra ? 0 : d.totalRS });
    });
    transferencias.forEach(t => {
        if(t === atual || t._pendente) return;
        let o = chave(t.data);
        if(!o || o > limite) return;
        let valor = Number(t.valorTotal) || 0;
        if(t.loteDestino === nomeLote) eventos.push({ o, delta: Number(t.quantidade) || 0, gasto: valor, receita: 0 });
        if(t.loteOrigem === nomeLote) eventos.push({ o, delta: -(Number(t.quantidade) || 0), gasto: -valor, receita: 0 });
    });
    eventos.sort((a, b) => a.o.localeCompare(b.o));

    let cabecas = 0, inicio = eventos.length ? eventos[0].o : null, aguardando = false;
    eventos.forEach(e => {
        if(aguardando){ inicio = e.o; aguardando = false; }
        cabecas += e.delta;
        if(cabecas <= 0) aguardando = true;
    });
    let est = { gasto: 0, receita: 0, headcount: 0 };
    if(aguardando) return est; // ciclo já fechado: não sobrou animal nenhum
    let noCiclo = o => !inicio || o >= inicio;
    eventos.forEach(e => {
        if(!noCiclo(e.o)) return;
        est.gasto += e.gasto; est.receita += e.receita; est.headcount += e.delta;
    });
    saidas.forEach(s => {
        if(s.loteNome !== nomeLote) return;
        let o = chave(s.data);
        if(!o || o > limite || !noCiclo(o)) return;
        est.gasto += Number(s.valorTotal) || 0;
    });
    lancamentos.forEach(l => {
        if(!l.loteNome || l.loteNome !== nomeLote) return;
        let o = chave(l.data);
        if(!o || o > limite || !noCiclo(o)) return;
        if(l.tipo === "saida") est.gasto += Number(l.valor) || 0;
        else est.receita += Number(l.valor) || 0;
    });
    return est;
}

function carregarDadosCustoLoteMobileResolvido(){
    resolverValoresTransferencias(transferenciasLotesCacheMobile, relatorios, estoqueSaidasCacheMobile, caixaLancamentosCacheMobile);
}

// mesma lógica de calcularInicioCicloLote() (admin.js) -- reescrita aqui
// porque aquela função lê variáveis (transferenciasLotesCacheAdmin) que só
// existem carregadas no desktop. Um lote fechado (headcount chega a 0) e
// reaberto com o mesmo nome só conta o ciclo atual, não a história inteira.
// chaveOrdenacao inclui hora (quando disponível) pra desempatar corretamente
// dois eventos no mesmo dia -- antes usava só extrairDataISO (dia), então um
// lote fechado (vendido até 0) e reaberto no MESMO DIA misturava a venda de
// fechamento do ciclo antigo dentro do ciclo novo (as datas "empatavam").
function chaveOrdenacaoLoteMobile(dataStr){
    let m = String(dataStr || "").match(/^(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2}):(\d{2})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}` : extrairDataISO(dataStr);
}

function calcularInicioCicloLoteMobile(nomeLote){
    let eventos = [];
    relatorios.forEach(r => {
        if((r.descricao || "Sem descrição") !== nomeLote) return;
        let ordem = chaveOrdenacaoLoteMobile(r.data);
        if(!ordem) return;
        let qtd = calcularDadosCompletos(r).totalAnimais;
        eventos.push({ ordem, delta: (r.tipo || "venda") === "compra" ? qtd : -qtd });
    });
    transferenciasLotesCacheMobile.forEach(t => {
        let ordem = chaveOrdenacaoLoteMobile(t.data);
        if(!ordem) return;
        if(t.loteDestino === nomeLote) eventos.push({ ordem, delta: t.quantidade });
        if(t.loteOrigem === nomeLote) eventos.push({ ordem, delta: -t.quantidade });
    });
    if(eventos.length === 0) return null;
    eventos.sort((a, b) => a.ordem.localeCompare(b.ordem));
    let headcount = 0;
    let inicioCiclo = eventos[0].ordem;
    let aguardandoNovoCiclo = false;
    eventos.forEach(ev => {
        if(aguardandoNovoCiclo){ inicioCiclo = ev.ordem; aguardandoNovoCiclo = false; }
        headcount += ev.delta;
        if(headcount <= 0) aguardandoNovoCiclo = true;
    });
    return inicioCiclo;
}

// agrega compra/venda/insumo/caixa/transferência de UM lote só (mesmo
// padrão do gerarRelatorioLotePDF do desktop, admin.js) -- devolve os
// números brutos; quem calcula custo restante/médio é calcularFormulaCustoLote().
function montarResumoLoteMobile(nomeLote){
    let inicioCiclo = calcularInicioCicloLoteMobile(nomeLote);
    function noCicloAtual(dataStr){
        if(!inicioCiclo) return true;
        let ordem = chaveOrdenacaoLoteMobile(dataStr);
        return ordem !== null && ordem >= inicioCiclo;
    }

    let g = { comprados: 0, vendidos: 0, kgComprado: 0, kgVendido: 0, custoCompra: 0, custoInsumos: 0, receitaVenda: 0, pesosCompra: [] };

    relatorios.forEach(r => {
        if((r.descricao || "Sem descrição") !== nomeLote) return;
        if(!noCicloAtual(r.data)) return;
        let d = calcularDadosCompletos(r);
        if((r.tipo || "venda") === "compra"){
            g.comprados += d.totalAnimais;
            g.kgComprado += d.totalKg;
            g.custoCompra += d.totalRS;
            (r.pesos || []).forEach(p => { if(Number(p.peso) > 0) g.pesosCompra.push(Number(p.peso)); });
        } else {
            g.vendidos += d.totalAnimais;
            g.kgVendido += d.totalKg;
            g.receitaVenda += d.totalRS;
        }
    });

    estoqueSaidasCacheMobile.forEach(s => {
        if(s.loteNome !== nomeLote || !noCicloAtual(s.data)) return;
        g.custoInsumos += s.valorTotal;
    });

    caixaLancamentosCacheMobile.forEach(l => {
        if(!l.loteNome || l.loteNome !== nomeLote || !noCicloAtual(l.data)) return;
        if(l.tipo === "saida") g.custoInsumos += l.valor;
        else g.receitaVenda += l.valor;
    });

    // transferência tira headcount E o custo que foi junto com os animais do
    // lote origem (sem isso o valor ficava contado nos dois lotes ao mesmo
    // tempo) e leva os dois pro destino.
    transferenciasLotesCacheMobile.forEach(t => {
        if(t.loteOrigem === nomeLote && noCicloAtual(t.data)){
            g.vendidos += t.quantidade;
            g.kgVendido += Number(t.kgTotal) || 0;
            g.custoCompra -= t.valorTotal;
        }
        if(t.loteDestino === nomeLote && noCicloAtual(t.data)){
            g.comprados += t.quantidade;
            g.kgComprado += Number(t.kgTotal) || 0;
            g.custoCompra += t.valorTotal;
            (t.pesos || []).forEach(p => { if(Number(p.peso) > 0) g.pesosCompra.push(Number(p.peso)); });
        }
    });

    return g;
}

// fórmula final compartilhada com o desktop -- admin.js's mostrarCustoPorLote()
// chama essa mesma função em vez de repetir a conta, pra garantir que os
// números do celular e do gerenciamento nunca podem divergir. Custo restante
// é quanto do que foi gasto no lote (compra+insumo) ainda não voltou em
// venda, repartido pelos animais que sobraram.
function calcularFormulaCustoLote(g){
    let headcount = g.comprados - g.vendidos;
    let kgAtual = g.kgComprado - g.kgVendido;
    let gastoTotal = g.custoCompra + g.custoInsumos;
    let custoRestante = gastoTotal - g.receitaVenda;
    let custoMedio = headcount > 0 ? custoRestante / headcount : 0;
    let custoPorKg = kgAtual > 0 ? custoRestante / kgAtual : 0;
    return { headcount, kgAtual, custoRestante, custoMedio, custoPorKg };
}

async function atualizarDashboardLoteMobile(){
    mostrarDashboard();

    let filtroLoteEl = document.getElementById("filtroLote");
    let secao = document.getElementById("dashboardLoteDetalhado");
    let simulador = document.getElementById("simuladorVenda");
    if(!filtroLoteEl || !secao) return;

    let nomeLote = filtroLoteEl.value;
    let podeVerDetalhe = obterPapelLogado() === "admin";

    if(!nomeLote || !podeVerDetalhe){
        secao.style.display = "none";
        if(simulador) simulador.style.display = "none";
        return;
    }

    await carregarDadosCustoLoteMobile();

    let g = montarResumoLoteMobile(nomeLote);
    let f = calcularFormulaCustoLote(g);
    let kgMedioPorAnimal = g.comprados > 0 ? g.kgComprado / g.comprados : 0;
    let valorMedioPorAnimal = g.comprados > 0 ? g.custoCompra / g.comprados : 0;

    function set(id, texto){
        let el = document.getElementById(id);
        if(el) el.innerText = texto;
    }
    // mesmo tratamento do desktop (formatarValorPossivelmenteNegativo, admin.js):
    // custo restante negativo é lucro já realizado (verde), custo restante
    // positivo com o lote já ENCERRADO (headcount 0) é prejuízo realizado
    // (vermelho) -- sem isso o celular mostrava "R$ -1.200,00" cru (fácil de
    // ler como "ainda devendo") ou "R$ 0,00" escondendo um prejuízo real.
    function setValorLote(id, valor, mostrar){
        let el = document.getElementById(id);
        if(!el) return;
        if(!mostrar){ el.innerText = "—"; el.style.color = "inherit"; return; }
        if(valor < 0){ el.innerText = "▲ R$ " + formatarMoeda(Math.abs(valor)) + " (lucro)"; el.style.color = "#0ca30c"; return; }
        if(valor > 0 && f.headcount === 0){ el.innerText = "▼ R$ " + formatarMoeda(valor) + " (prejuízo)"; el.style.color = "#d03b3b"; return; }
        el.innerText = "R$ " + formatarMoeda(valor);
        el.style.color = "inherit";
    }
    set("dashLoteAtivos", String(f.headcount));
    set("dashLoteKgCompra", formatarPeso(g.kgComprado) + " kg");
    set("dashLoteKgMedio", formatarPeso(kgMedioPorAnimal) + " kg");
    set("dashLoteValorCompra", "R$ " + formatarMoeda(g.custoCompra));
    set("dashLoteValorMedio", "R$ " + formatarMoeda(valorMedioPorAnimal));
    setValorLote("dashLoteCustoTotal", f.custoRestante, true);
    setValorLote("dashLoteCustoMedio", f.custoMedio, f.headcount > 0);
    setValorLote("dashLoteCustoPorKg", f.custoPorKg, f.kgAtual > 0);

    secao.style.display = "block";
    let elNomeLote = document.getElementById("dashLoteNomeSelecionado");
    if(elNomeLote) elNomeLote.innerText = nomeLote;

    if(simulador){
        simulador.style.display = "block";
        simulador.dataset.animaisAtivos = String(f.headcount);
        simulador.dataset.custoTotal = String(f.custoRestante);
        simulador.dataset.pesosCompra = JSON.stringify(g.pesosCompra);
        let campoPeso = document.getElementById("simPesoMedio");
        let campoQtd = document.getElementById("simQuantidade");
        // troca de lote sempre reinicia o simulador pros valores desse lote
        // -- só onchange do próprio &lt;select&gt; chega aqui, então não corre o
        // risco de apagar algo que o operador estava digitando à toa
        if(campoPeso) campoPeso.value = kgMedioPorAnimal.toFixed(2).replace(".", ",");
        if(campoQtd) campoQtd.value = f.headcount;
        atualizarSimuladorVenda();
    }
}

function alternarModoSimulador(modo){
    let btnKg = document.getElementById("simModoKg");
    let btnPerna = document.getElementById("simModoPerna");
    let btnMisto = document.getElementById("simModoMisto");
    let labelPeso = document.getElementById("simPesoMedioLabel");
    if(btnKg) btnKg.classList.toggle("criterioBtnAtivo", modo === "kg");
    if(btnPerna) btnPerna.classList.toggle("criterioBtnAtivo", modo === "perna");
    if(btnMisto) btnMisto.classList.toggle("criterioBtnAtivo", modo === "misto");
    // no Misto o preço/peso/quantidade vêm de outros campos (limite + 2
    // preços) e o lote ativo é vendido inteiro
    let ehMisto = modo === "misto";
    ["simPrecoCartao", "simPesoMedioCartao", "simQuantidadeCartao"].forEach(id => {
        let el = document.getElementById(id);
        if(el) el.style.display = ehMisto ? "none" : "";
    });
    let camposMisto = document.getElementById("simMistoCampos");
    if(camposMisto) camposMisto.style.display = ehMisto ? "block" : "none";
    let detalheMisto = document.getElementById("simMistoDetalhe");
    if(detalheMisto) detalheMisto.style.display = ehMisto ? "block" : "none";
    // no modo "Na Perna" o peso não entra na conta do valor da venda (preço é
    // por cabeça), mas o campo continua visível -- é o que dá o kg estimado
    // dos vendidos, usado só pra demonstrar o Custo por Kg do Restante
    if(labelPeso) labelPeso.innerText = modo === "kg"
        ? "Peso médio estimado (kg)"
        : "Kg estimado médio dos vendidos";
    let simulador = document.getElementById("simuladorVenda");
    if(simulador) simulador.dataset.modo = modo;
    atualizarSimuladorVenda();
}

// "3100", "3.100", "3.100,00", "15,5" e "206.5" -- ponto só vira milhar quando
// está no formato de milhar (1 a 3 dígitos + grupos de 3)
function lerNumeroSimulador(texto){
    let t = String(texto || "").trim().replace(/\s/g, "").replace(/R\$/g, "");
    if(t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    else if(/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    let n = Number(t);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

// Modo Misto: separa os animais do lote pelo PESO DE COMPRA de cada um --
// até o limite vende na perna (preço por cabeça), acima vende por kg
// (preço × peso de compra do animal). Se o lote hoje tem um número de
// animais diferente do que foi pesado na compra (já vendeu/transferiu
// alguns), não dá pra saber QUAIS saíram, então as duas faixas são
// ajustadas na mesma proporção e o aviso aparece na tela.
function calcularVendaMistaSimulador(simulador, animaisAtivos){
    let pesos = [];
    try{ pesos = JSON.parse(simulador.dataset.pesosCompra || "[]"); }catch(e){}
    let limite = lerNumeroSimulador((document.getElementById("simMistoLimite") || {}).value);
    let precoPerna = lerNumeroSimulador((document.getElementById("simMistoPrecoPerna") || {}).value);
    let precoKg = lerNumeroSimulador((document.getElementById("simMistoPrecoKg") || {}).value);

    let leves = pesos.filter(p => p <= limite);
    let pesados = pesos.filter(p => p > limite);
    let fator = pesos.length > 0 ? animaisAtivos / pesos.length : 0;
    let qtdLeves = Math.min(animaisAtivos, Math.round(leves.length * fator));
    let qtdPesados = Math.max(animaisAtivos - qtdLeves, 0);
    let kgMedioPesados = pesados.length > 0 ? pesados.reduce((s, p) => s + p, 0) / pesados.length : 0;
    let kgPesados = kgMedioPesados * qtdPesados;
    let valorPerna = qtdLeves * precoPerna;
    let valorKg = kgPesados * precoKg;

    function set(id, texto){ let el = document.getElementById(id); if(el) el.innerText = texto; }
    let textoLimite = limite > 0 ? formatarPeso(limite) + " kg" : "o limite";
    set("simMistoPernaRotulo", `Na perna (até ${textoLimite}): ${qtdLeves} × R$ ${formatarMoeda(precoPerna)}`);
    set("simMistoPernaValor", "R$ " + formatarMoeda(valorPerna));
    set("simMistoKgRotulo", `Por kg (acima): ${qtdPesados} anim. · ${formatarPeso(Math.round(kgPesados * 10) / 10)} kg × R$ ${formatarMoeda(precoKg)}`);
    set("simMistoKgValor", "R$ " + formatarMoeda(valorKg));

    let aviso = document.getElementById("simMistoAviso");
    if(aviso){
        let texto = "";
        if(pesos.length === 0) texto = "Este lote não tem pesagem de compra — não dá pra separar os animais pelo peso.";
        else if(pesos.length !== animaisAtivos) texto = `Na compra foram pesados ${pesos.length} animais e hoje o lote tem ${animaisAtivos}. Como não dá pra saber quais saíram, as duas faixas foram ajustadas na mesma proporção.`;
        aviso.innerText = texto;
        aviso.style.display = texto ? "block" : "none";
    }
    return { valorVenda: valorPerna + valorKg, qtdLeves, qtdPesados, kgPesados };
}

function atualizarSimuladorVenda(){
    let simulador = document.getElementById("simuladorVenda");
    if(!simulador) return;

    let modo = simulador.dataset.modo || "kg";
    let animaisAtivos = parseFloat(simulador.dataset.animaisAtivos || "0") || 0;
    let custoTotalLote = parseFloat(simulador.dataset.custoTotal || "0") || 0;

    let campoPreco = document.getElementById("simPreco");
    let campoPeso = document.getElementById("simPesoMedio");
    let campoQtd = document.getElementById("simQuantidade");

    let preco = campoPreco ? (parseFloat(campoPreco.value.replace(",", ".")) || 0) : 0;
    let pesoMedio = campoPeso ? (parseFloat(campoPeso.value.replace(",", ".")) || 0) : 0;
    let qtdVendida = campoQtd ? (parseFloat(campoQtd.value.replace(",", ".")) || 0) : 0;
    if(qtdVendida > animaisAtivos) qtdVendida = animaisAtivos;
    if(qtdVendida < 0) qtdVendida = 0;

    let valorVenda = modo === "kg" ? (preco * pesoMedio * qtdVendida) : (preco * qtdVendida);
    if(modo === "misto"){
        let misto = calcularVendaMistaSimulador(simulador, animaisAtivos);
        valorVenda = misto.valorVenda;
        qtdVendida = animaisAtivos;
        pesoMedio = 0;
    }
    let restantes = animaisAtivos - qtdVendida;
    // modelo único de "recuperação de investimento": o lote inteiro é um
    // investimento só, e só existe lucro de verdade depois que o valor total
    // investido no lote volta em venda -- lucro e custo do restante vêm da
    // MESMA conta (valorVenda vs custoTotalLote), pra nunca mostrar os dois
    // positivos ao mesmo tempo (antes usava contas diferentes -- custo
    // vendidos pela média por cabeça pro lucro, caixa real pro restante --
    // e podiam contradizer um ao outro, como o Herlon percebeu)
    let lucro = valorVenda - custoTotalLote;
    let custoRestante = Math.max(custoTotalLote - valorVenda, 0);
    let custoMedioRestante = restantes > 0 ? custoRestante / restantes : 0;
    let kgRestante = pesoMedio * restantes;
    let custoPorKgRestante = kgRestante > 0 ? custoRestante / kgRestante : 0;

    function set(id, texto){
        let el = document.getElementById(id);
        if(el) el.innerText = texto;
    }
    set("simResultadoValorVenda", "R$ " + formatarMoeda(valorVenda));
    set("simResultadoInvestimentoTotal", "R$ " + formatarMoeda(custoTotalLote));
    let elLucro = document.getElementById("simResultadoLucro");
    if(elLucro){
        let positivo = lucro >= 0;
        elLucro.innerText = (positivo ? "▲ R$ " : "▼ R$ ") + formatarMoeda(Math.abs(lucro));
        elLucro.style.color = positivo ? "#0ca30c" : "#d03b3b";
    }
    set("simResultadoRestantes", String(restantes));
    set("simResultadoCustoRestante", "R$ " + formatarMoeda(custoRestante));
    set("simResultadoCustoMedioRestante", "R$ " + formatarMoeda(custoMedioRestante));
    set("simResultadoCustoPorKgRestante", "R$ " + formatarMoeda(custoPorKgRestante));
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

        // se essa pesagem foi salva junto com outra(s) na mesma sessão
        // (mais de 1 critério usado), junta tudo num recibo só -- o
        // vendedor recebe UM pagamento mesmo sendo 2-3 lotes diferentes
        let registros = obterRegistrosDaSessao(r);
        let multiplos = registros.length > 1;
        let totalGeral = 0;

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
        pdf.text(`Data/Hora: ${calcularDadosCompletos(r).dataHora}`, 110, y);
        y += 10;

        registros.forEach((registro, indiceLote) => {
            let d = calcularDadosCompletos(registro);
            totalGeral += d.totalRS;

            if(y > 250){ pdf.addPage(); y = 20; }

            if(multiplos){
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(13);
                pdf.text(`Lote ${indiceLote + 1}: ${registro.descricao || "Sem Descrição"}`, 10, y);
                y += 8;
                pdf.setFontSize(11);
            } else {
                pdf.text(`Lote/Desc: ${registro.descricao || 'Sem Descrição'}`, 10, y);
            pdf.text(d.ehFaixas ? "Preço por faixa de peso" : `${d.ehValorAnimal ? "Valor/Animal" : "Valor base/kg"}: R$ ${formatarMoeda(d.valorKgNum)}`, 110, y);
                y += 7;
            }

            pdf.setFont("helvetica", "normal");
            if(multiplos){
                pdf.text(d.ehFaixas ? "Preço por faixa de peso" : `${d.ehValorAnimal ? "Valor/Animal" : "Valor base/kg"}: R$ ${formatarMoeda(d.valorKgNum)}`, 10, y);
                pdf.text(`Total de Cabeças: ${d.totalAnimais}`, 110, y);
                y += 7;
                pdf.text(`Peso Acumulado: ${formatarPeso(d.totalKg)} kg`, 10, y);
                pdf.text(`Subtotal deste lote: R$ ${formatarMoeda(d.totalRS)}`, 110, y);
                y += 7;
            } else {
                pdf.text(`Total de Cabeças: ${d.totalAnimais}`, 10, y);
                pdf.text(`Peso Acumulado: ${formatarPeso(d.totalKg)} kg`, 110, y);
                y += 7;
                pdf.text(`Faturamento Lote: R$ ${formatarMoeda(d.totalRS)}`, 10, y);
                pdf.text(`Média por Animal: ${d.mediaKg.toFixed(2).replace(".", ",")} kg`, 110, y);
                y += 7;
            }

            if(d.ehArroba){
                pdf.text(`Total em Arrobas: ${d.totalArroba.toFixed(2).replace(".", ",")} @ (Rend. ${d.rendimentoNum}%)`, 10, y);
                y += 7;
            }

            y += 3;
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

            registro.pesos.forEach((p, i) => {
                if (y > 270) {
                    pdf.addPage();
                    y = 20;
                }

                let pAtual = p.peso || 0;
                let valorInd = d.valorDoItem(pAtual, p);
                pdf.text(String(i + 1), 10, y);
                pdf.text(`${formatarPeso(pAtual)} kg`, 40, y);
                pdf.text(`R$ ${formatarMoeda(valorInd)}`, 90, y);
                pdf.text(p.obs || "-", 150, y);
                y += 7;
            });

            y += 6;
        });

        if(multiplos){
            if(y > 260){ pdf.addPage(); y = 20; }
            pdf.line(10, y, 200, y);
            y += 10;
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(15);
            pdf.text(`TOTAL GERAL A PAGAR: R$ ${formatarMoeda(totalGeral)}`, 105, y, { align: "center" });
        }

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

// Dado um relatório selecionado, retorna todos os registros que foram
// salvos JUNTOS na mesma finalização (mesmo sessaoId) -- normalmente é só
// [r] mesmo (a grande maioria das pesagens usa 1 critério só); quando o
// operador usou 2-3 critérios na mesma sessão, isso deixa o relatório de
// impressão/PDF/WhatsApp juntar tudo num recibo só (mesmo vendedor, valor
// total a pagar numa tacada), SEM mudar como cada pesagem é tratada em
// Custo por Lote/Dashboard/Resultado Mensal -- lá continuam sendo
// registros 100% independentes, isso aqui é só pra exibição/recibo.
function obterRegistrosDaSessao(r){
    if(!r || !r.sessaoId) return [r];
    return relatorios.filter(item => item.sessaoId === r.sessaoId);
}

function calcularDadosCompletos(r) {
    let stringValor = String(r.valorKg || "0");
    let valorKgNum = parseFloat(stringValor.replace("R$ ", "").replace(/\./g, "").replace(",", ".")) || 0;

    let ehArroba = r.tipoPesagem === "arroba";
    let ehValorAnimal = r.tipoPesagem === "valor_animal";
    let rendimentoNum = parseFloat(String(r.rendimento || "0").replace(",", ".")) || 0;

    let listaPesos = r.pesos ? r.pesos.map(p => p.peso || 0) : [];
    let pesosOrdenados = [...listaPesos].sort((a, b) => a - b);
    let totalKg = pesosOrdenados.reduce((sum, w) => sum + w, 0);
    let totalAnimais = pesosOrdenados.length;
    let totalArroba = converterParaArroba(totalKg, rendimentoNum);
    let arrobaDe = pesoKg => converterParaArroba(pesoKg, rendimentoNum);

    // valor_animal: preço combinado por cabeça ("na perna"), não por peso --
    // o animal é pesado só pra controle, então o valor de cada um é o mesmo
    // valor fixo, e o total é cabeças × valor fixo (não peso × valor).
    let valorDoItem = (pesoKg, item) => {
        if(item && Number.isFinite(Number(item.valorRS))) return Number(item.valorRS);
        if(r.tipoPesagem === "faixas"){
            let calculo = calcularValorFaixa(pesoKg, r.faixasPreco);
            return calculo ? calculo.valorRS : 0;
        }
        return ehValorAnimal ? valorKgNum : ((ehArroba ? arrobaDe(pesoKg) : pesoKg) * valorKgNum);
    };
    let totalRS = (r.pesos || []).reduce((sum, item) => sum + valorDoItem(item.peso || 0, item), 0);

    return {
        valorKgNum: valorKgNum,
        totalKg: totalKg,
        totalAnimais: totalAnimais,
        mediaKg: totalAnimais ? (totalKg / totalAnimais) : 0,
        totalRS: totalRS,
        totalArroba: totalArroba,
        ehArroba: ehArroba,
        ehValorAnimal: ehValorAnimal,
        ehFaixas: r.tipoPesagem === "faixas",
        // taxa de R$/kg que o preço fixo por animal acabou equivalendo, na
        // média do lote -- útil pro rancheiro comparar com o mercado, já que
        // a negociação foi por cabeça e não por peso.
        kgImplicitoMedio: totalKg > 0 ? (totalRS / totalKg) : 0,
        rendimentoNum: rendimentoNum,
        arrobaDe: arrobaDe,
        valorDoItem: valorDoItem,
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
    // mesma pesagem, mais de um critério na mesma sessão? junta num
    // documento só (ver obterRegistrosDaSessao) -- um único valor a pagar
    let registros = obterRegistrosDaSessao(r);
    let multiplos = registros.length > 1;
    let ehCompra = (r.tipo || "venda") === "compra";
    let esc = escaparHtmlPesagem;
    let totalGeral = 0, animaisGeral = 0, kgGeral = 0;

    function quadro(rotulo, valor, destaque){
        return `<div class="folhaQuadro${destaque ? " folhaQuadroDestaque" : ""}"><span>${rotulo}</span><b>${valor}</b></div>`;
    }
    function textoPreco(d){
        if(d.ehFaixas) return "Por faixa de peso";
        if(d.ehValorAnimal) return "R$ " + formatarMoeda(d.valorKgNum) + " por animal";
        if(d.ehArroba) return "R$ " + formatarMoeda(d.valorKgNum) + " por @ (rend. " + d.rendimentoNum + "%)";
        return "R$ " + formatarMoeda(d.valorKgNum) + " por kg";
    }

    let html = `
        <header class="folhaTopo">
            <div>
                <div class="folhaFazenda">${esc(nomeFazendaAtual())}</div>
                <h1>Relatório de Pesagem${r.numero ? " Nº " + r.numero : ""}</h1>
            </div>
            <div class="folhaTopoDireita">
                <span class="folhaSelo ${ehCompra ? "folhaSeloCompra" : "folhaSeloVenda"}">${ehCompra ? "COMPRA" : "VENDA"}</span>
                <small>Emitido em ${new Date().toLocaleString("pt-BR")}</small>
            </div>
        </header>
        <section class="folhaDados">
            <div><span>${ehCompra ? "Vendedor" : "Comprador / Vendedor"}</span><b>${esc(r.vendedor || "Não informado")}</b></div>
            <div><span>Data da pesagem</span><b>${esc(calcularDadosCompletos(r).dataHora)}</b></div>
            <div><span>${multiplos ? "Lotes" : "Lote"}</span><b>${esc(registros.map(x => x.descricao || "Sem lote").join(", "))}</b></div>
            <div><span>Lançado por</span><b>${esc(r.criadoPor || obterUsuarioLogado() || "—")}</b></div>
        </section>
    `;

    registros.forEach((registro, indice) => {
        let d = calcularDadosCompletos(registro);
        totalGeral += d.totalRS;
        animaisGeral += d.totalAnimais;
        kgGeral += d.totalKg;
        let pesos = (registro.pesos || []).map(p => Number(p.peso) || 0);
        let maior = pesos.length ? Math.max(...pesos) : 0;
        let menor = pesos.length ? Math.min(...pesos) : 0;
        let valorMedio = d.totalAnimais ? d.totalRS / d.totalAnimais : 0;

        if(multiplos){
            html += `<h2 class="folhaSecao">Lote ${indice + 1}: ${esc(registro.descricao || "Sem lote")} <small>${textoPreco(d)}</small></h2>`;
        }
        html += `<section class="folhaResumo">`;
        html += quadro("Animais", d.totalAnimais);
        html += quadro("Peso total", formatarPeso(d.totalKg) + " kg");
        html += quadro("Peso médio", formatarPeso(Math.round(d.mediaKg * 10) / 10) + " kg");
        html += quadro("Mais pesado", formatarPeso(maior) + " kg");
        html += quadro("Mais leve", formatarPeso(menor) + " kg");
        if(!multiplos) html += quadro("Preço", textoPreco(d));
        html += quadro("Valor médio / animal", "R$ " + formatarMoeda(valorMedio));
        html += quadro("R$ médio por kg", "R$ " + formatarMoeda(d.kgImplicitoMedio));
        if(d.ehArroba) html += quadro("Total em arrobas", d.totalArroba.toFixed(2).replace(".", ",") + " @");
        html += quadro(multiplos ? "Subtotal deste lote" : "Valor total", "R$ " + formatarMoeda(d.totalRS), true);
        html += `</section>`;

        // lista de pesos em DUAS colunas lado a lado (1|2, 3|4...) pra usar a
        // folha inteira -- numa tabela só, que quebra de página certinho e
        // repete o cabeçalho. Em tela estreita (celular) aparece a versão de
        // uma coluna. Totais: só no resumo de cima; com mais de um lote, cada
        // lote mostra o subtotal dele embaixo da lista.
        let colunaExtra = d.ehArroba ? "<th>Arrobas</th>" : (d.ehValorAnimal || d.ehFaixas ? "<th>R$ / kg</th>" : "");
        let celulas = (p, i) => {
            if(!p) return `<td></td><td></td>${colunaExtra ? "<td></td>" : ""}<td></td><td class="folhaObs"></td>`;
            let kg = Number(p.peso) || 0;
            let valor = d.valorDoItem(kg, p);
            let extra = d.ehArroba ? `<td>${d.arrobaDe(kg).toFixed(2).replace(".", ",")} @</td>`
                : (d.ehValorAnimal || d.ehFaixas ? `<td>R$ ${kg > 0 ? formatarMoeda(valor / kg) : "—"}</td>` : "");
            return `<td class="folhaNum">${i + 1}</td><td>${formatarPeso(kg)} kg</td>${extra}<td>R$ ${formatarMoeda(valor)}</td><td class="folhaObs">${esc(p.obs || "")}</td>`;
        };
        let lista = registro.pesos || [];
        let nColunas = 4 + (colunaExtra ? 1 : 0);
        let cabecalho = `<th>Nº</th><th>Peso</th>${colunaExtra}<th>Valor</th><th>Obs.</th>`;
        let subtotal = multiplos
            ? `<tfoot><tr><td colspan="__COLS__" class="folhaSubtotal">Subtotal deste lote: ${d.totalAnimais} animais · ${formatarPeso(d.totalKg)} kg · <b>R$ ${formatarMoeda(d.totalRS)}</b></td></tr></tfoot>`
            : "";
        let linhasDupla = "";
        for(let i = 0; i < lista.length; i += 2){
            linhasDupla += `<tr>${celulas(lista[i], i)}<td class="folhaDivisor"></td>${celulas(lista[i + 1], i + 1)}</tr>`;
        }
        html += `<table class="folhaTabela folhaTabelaDupla"><thead><tr>${cabecalho}<th class="folhaDivisor"></th>${cabecalho}</tr></thead><tbody>${linhasDupla}</tbody>${subtotal.replace("__COLS__", nColunas * 2 + 1)}</table>`;
        html += `<table class="folhaTabela folhaTabelaSimples"><thead><tr>${cabecalho}</tr></thead><tbody>${lista.map((p, i) => `<tr>${celulas(p, i)}</tr>`).join("")}</tbody>${subtotal.replace("__COLS__", nColunas)}</table>`;
    });

    if(multiplos){
        html += `<section class="folhaTotalGeral"><span>${animaisGeral} animais · ${formatarPeso(kgGeral)} kg</span><b>TOTAL GERAL A PAGAR: R$ ${formatarMoeda(totalGeral)}</b></section>`;
    }

    html += `
        <footer class="folhaRodape">
            <div class="folhaAssinaturas">
                <div><span></span>${ehCompra ? "Vendedor" : "Comprador"}</div>
                <div><span></span>${esc(nomeFazendaAtual())}</div>
            </div>
            <small>Relatório gerado pelo PesoCerto</small>
        </footer>
    `;

    let folha = document.getElementById("folhaRelatorio");
    if(folha) folha.innerHTML = html;
    // a mesma tela também imprime o extrato do Fluxo de Caixa (computador)
    let telaImp = document.getElementById("telaImpressao");
    if(telaImp) telaImp.classList.remove("modoExtrato");
    let voltarTexto = document.getElementById("impressaoVoltarTexto");
    if(voltarTexto) voltarTexto.innerText = "Voltar aos relatórios";
    registrosImpressaoAtual = registros;
    let titulo = document.getElementById("impressaoTitulo");
    if(titulo) titulo.innerText = `${ehCompra ? "Compra" : "Venda"}${r.numero ? " nº " + r.numero : ""} · ${r.vendedor || "Sem vendedor"}`;
    trocarTela("telaImpressao");
    window.scrollTo(0, 0);
}

// o relatório aberto na tela de impressão -- usado pelo botão WhatsApp
let registrosImpressaoAtual = [];
function enviarImpressaoWhatsApp(){
    if(!registrosImpressaoAtual.length) return;
    window.open("https://wa.me/?text=" + encodeURIComponent(montarMensagemWhatsApp(registrosImpressaoAtual)), "_blank");
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
    // mesma sessão com vários critérios? junta todos os lotes numa
    // planilha só, com uma coluna "Lote" pra diferenciar as linhas --
    // senão a exportação ficava incompleta em relação ao cartão agrupado
    // que o operador vê na lista
    let registros = typeof obterRegistrosDaSessao === "function" ? obterRegistrosDaSessao(r) : [r];
    let multiplos = registros.length > 1;
    let dataExcel = [];
    let ordemGeral = 0;

    registros.forEach(registro => {
        let d = calcularDadosCompletos(registro);
        (registro.pesos || []).forEach((p) => {
            ordemGeral++;
            let linha = { "Ordem": ordemGeral };
            if(multiplos) linha["Lote"] = registro.descricao || "Sem descrição";
            linha["Peso (kg)"] = p.peso || 0;
            linha["Valor (R$)"] = Number(d.valorDoItem(p.peso || 0, p).toFixed(2));
            if(d.ehArroba){
                linha["Arrobas (@)"] = Number(d.arrobaDe(p.peso || 0).toFixed(2));
            }
            linha["Anotação"] = p.obs || "";
            dataExcel.push(linha);
        });
    });

    let worksheet = XLSX.utils.json_to_sheet(dataExcel);
    let workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pesagem");
    XLSX.writeFile(workbook, nomeArquivoPesagem(r, "xlsx"));
}

// ========================================
// COMPARTILHAR NO WHATSAPP
// ========================================
// registros: 1 a 3 pesagens da MESMA sessão (ver obterRegistrosDaSessao) --
// com só 1 registro, a mensagem sai idêntica a como sempre foi; com mais
// de 1 (operador usou vários critérios na mesma entrega), cada lote ganha
// seu próprio bloco de resumo+pesagens e a mensagem fecha com um total
// geral só, pra facilitar um pagamento único ao vendedor.
function montarMensagemWhatsApp(registros){
    let r = registros[0];
    let multiplos = registros.length > 1;
    let totalGeral = 0;

    let linhas = [];
    linhas.push("📋 *RELATÓRIO DE PESAGEM*" + (r.numero ? " — Nº " + r.numero : ""));
    linhas.push("");
    linhas.push("*Tipo:* " + ((r.tipo || "venda") === "compra" ? "Compra" : "Venda"));
    linhas.push("*Vendedor:* " + (r.vendedor || "Não informado"));
    linhas.push("*Data:* " + calcularDadosCompletos(r).dataHora);
    if(!multiplos){
        linhas.push("*Lote/Descrição:* " + (r.descricao || "Sem descrição"));
    }

    registros.forEach((registro, indiceLote) => {
        let d = calcularDadosCompletos(registro);
        totalGeral += d.totalRS;
        let valorMedio = d.totalAnimais ? d.totalRS / d.totalAnimais : 0;

        linhas.push("");
        if(multiplos){
            linhas.push("━━━━━━━━━━━━━━━");
            linhas.push("📦 *LOTE " + (indiceLote + 1) + ": " + (registro.descricao || "Sem descrição") + "*");
        } else {
            linhas.push("*RESUMO*");
        }
        linhas.push(d.ehFaixas ? "*Preço:* por faixa de peso" : "*Valor:* R$ " + formatarMoeda(d.valorKgNum) + (d.ehValorAnimal ? " por animal" : (d.ehArroba ? " por @" : " por kg")));
        linhas.push("Total de animais: " + d.totalAnimais);
        linhas.push("Peso total: " + formatarPeso(d.totalKg) + " kg");
        linhas.push("Peso médio: " + d.mediaKg.toFixed(2).replace(".", ",") + " kg");
        if(d.ehArroba){
            linhas.push("Total em arrobas: " + d.totalArroba.toFixed(2).replace(".", ",") + " @ (Rend. " + d.rendimentoNum + "%)");
        }
        if(d.ehValorAnimal){
            linhas.push("R$/kg médio (implícito no preço fixo): R$ " + formatarMoeda(d.kgImplicitoMedio));
        }
        linhas.push("Valor médio por animal: R$ " + formatarMoeda(valorMedio));
        linhas.push("3 mais pesados: " + d.pesados);
        linhas.push("3 mais leves: " + d.leves);
        linhas.push((multiplos ? "*Subtotal deste lote: R$ " : "*Faturamento total: R$ ") + formatarMoeda(d.totalRS) + "*");
        linhas.push("");
        linhas.push("*PESAGENS*");
        (registro.pesos || []).forEach((p, i) => {
            let pesoKg = p.peso || 0;
            let valorInd = d.valorDoItem(pesoKg, p);
            let linha = (i + 1) + " - " + formatarPeso(pesoKg) + "kg";
            if(d.ehArroba){
                linha += " (" + d.arrobaDe(pesoKg).toFixed(2).replace(".", ",") + " @)";
            }
            if(d.ehValorAnimal && pesoKg > 0){
                linha += " (R$ " + formatarMoeda(d.valorKgNum / pesoKg) + "/kg)";
            }
            linha += " - R$ " + formatarMoeda(valorInd);
            if(p.obs) linha += " [" + p.obs + "]";
            linhas.push(linha);
        });
    });

    linhas.push("");
    linhas.push(multiplos
        ? "💰 *TOTAL GERAL A PAGAR: R$ " + formatarMoeda(totalGeral) + "*"
        : "💰 *Total: R$ " + formatarMoeda(totalGeral) + "*");
    return linhas.join("\n");
}

function compartilharWhatsApp(){
    let sel = document.querySelector("input[name='relatorioSelecionado']:checked");
    if(!sel){ alert("Selecione um relatório primeiro!"); return; }

    let indiceReal = parseInt(sel.value);
    let r = relatorios[indiceReal];
    if(!r || !r.pesos){ alert("Erro ao ler os dados do relatório selecionado."); return; }

    let registros = obterRegistrosDaSessao(r);
    let mensagem = montarMensagemWhatsApp(registros);
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

    // se o cartão selecionado representa uma sessão com vários critérios
    // (agrupados na lista, ver mostrarRelatorios), excluir precisa apagar
    // TODOS os lotes daquela sessão -- senão sobra lote órfão escondido
    let registro = relatorios[sel.value];
    let registros = typeof obterRegistrosDaSessao === "function" ? obterRegistrosDaSessao(registro) : [registro];
    let multiplos = registros.length > 1;

    let avisoFrete = (registro && (registro.tipo || "venda") === "compra") ? "\n\nSe teve frete lançado nessa compra, ele também será excluído do caixa." : "";
    let confirmado = multiplos
        ? confirm(`Essa pesagem tem ${registros.length} lotes lançados na mesma sessão. Deseja excluir TODOS eles permanentemente?` + avisoFrete)
        : confirm("Deseja excluir este relatório permanentemente?" + avisoFrete);
    if(!confirmado) return;

    for(let r of registros){
        if(!r || (r.tipo || "venda") !== "compra" || !r.descricao) continue;
        let saldo = saldoLoteLocal(r.descricao);
        let animais = (r.pesos || []).length;
        if(saldo !== null && r.sincronizado && saldo - animais < 0){
            alert(`Não dá pra excluir essa compra: o lote "${r.descricao}" tem ${saldo} animal(is) no saldo e ela trouxe ${animais}. Parte deles já foi vendida ou transferida — exclua antes a venda/transferência.`);
            return;
        }
    }

    let idsParaRemover = new Set(registros.filter(r => r && r.id).map(r => r.id));
    relatorios.forEach(r => {
        if(r && idsParaRemover.has(r.id) && typeof registrarExclusaoPendente === "function"){
            registrarExclusaoPendente(r.id);
        }
    });
    relatorios = relatorios.filter(r => !r || !idsParaRemover.has(r.id));
    localStorage.setItem("pesagens", JSON.stringify(relatorios));
    // frete dessa compra que ainda não tinha subido (sem internet) não sobe mais
    let fretesPendentes = JSON.parse(localStorage.getItem("despesasFretePendentes") || "[]");
    localStorage.setItem("despesasFretePendentes", JSON.stringify(fretesPendentes.filter(f => !idsParaRemover.has(f.pesagemId))));

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
            handle.style.background = "";
            handle.style.color = "";
            handle.innerText = "⇄";
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
        handle.style.background = "";
        handle.style.color = "";
        handle.innerText = "⇄";

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

function obterPermEditarNascimentos(){
    return localStorage.getItem("permEditarNascimentos") === "1";
}

function aplicarRestricoesUsuario(){
    let selectTipo = document.getElementById("tipoOperacao");
    if(!selectTipo) return;

    Array.from(selectTipo.options).forEach(o => { o.disabled = false; });

    let permTipo = obterPermTipoPesagem();
    if(obterPapelLogado() !== "admin" && permTipo !== "ambos"){
        Array.from(selectTipo.options).forEach(o => {
            if(o.value !== permTipo && o.value !== "transferencia") o.disabled = true;
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

// ========================================
// FAZENDA (sistema com várias fazendas)
// ========================================
// Cada fazenda tem os próprios dados no servidor. Aqui no aparelho fica
// guardado de qual fazenda são os dados locais (pesagens, rascunho, caches)
// -- se alguém entrar com o login de OUTRA fazenda neste aparelho, esses
// dados são apagados antes, senão sincronizariam na fazenda errada.
const CHAVES_DADOS_FAZENDA = ["pesagens", "pesagemAtual", "transferenciasPendentes", "despesasFretePendentes", "exclusoesPendentes", "estoqueSaidas", "nascimentos", "vacasMatriz", "lotesCache", "produtosCache", "pastosCache"];

// "<schema>:<aleatório>"; token sem ":" é de antes do multi-fazenda, e todos
// eram da fazenda original
function schemaDoTokenLocal(token){
    if(!token) return null;
    let i = token.indexOf(":");
    return i < 0 ? "public" : token.slice(0, i);
}

function nomeFazendaAtual(){
    let nome = localStorage.getItem("fazendaNome");
    if(nome) return nome;
    return schemaDoTokenLocal(obterToken()) === "public" ? "Estância Reis" : "Fazenda";
}

function ehDonoSistemaLocal(){
    return localStorage.getItem("donoSistema") === "1";
}

function contarPendentesLocais(){
    let total = 0;
    ["pesagens", "estoqueSaidas", "nascimentos", "vacasMatriz"].forEach(chave => {
        try{
            let lista = JSON.parse(localStorage.getItem(chave) || "[]");
            if(Array.isArray(lista)) total += lista.filter(item => item && !item.sincronizado).length;
        }catch(e){}
    });
    try{ total += (JSON.parse(localStorage.getItem("exclusoesPendentes") || "[]") || []).length; }catch(e){}
    try{ total += (JSON.parse(localStorage.getItem("transferenciasPendentes") || "[]") || []).length; }catch(e){}
    try{ total += (JSON.parse(localStorage.getItem("despesasFretePendentes") || "[]") || []).length; }catch(e){}
    if(localStorage.getItem("pesagemAtual")) total += 1;
    return total;
}

// devolve false se o operador desistiu (tinha coisa não enviada)
function prepararDadosLocaisParaFazenda(token){
    let nova = schemaDoTokenLocal(token);
    let anterior = localStorage.getItem("fazendaDadosSchema") || "public";
    if(nova === anterior){
        localStorage.setItem("fazendaDadosSchema", nova);
        return true;
    }
    let pendentes = contarPendentesLocais();
    if(pendentes > 0 && !confirm(`Este aparelho tem ${pendentes} registro(s) da fazenda anterior que ainda não foram enviados ao servidor.\n\nEntrando com o login de outra fazenda, eles serão APAGADOS deste aparelho.\n\nContinuar mesmo assim?`)){
        return false;
    }
    CHAVES_DADOS_FAZENDA.forEach(chave => localStorage.removeItem(chave));
    relatorios = [];
    pesos = [];
    localStorage.setItem("fazendaDadosSchema", nova);
    return true;
}

function guardarDadosFazenda(dados){
    if(dados && dados.fazenda){
        localStorage.setItem("fazendaNome", dados.fazenda.nome || "");
        localStorage.setItem("fazendaId", dados.fazenda.id || "");
    }
    if(dados && dados.donoSistema !== undefined) localStorage.setItem("donoSistema", dados.donoSistema ? "1" : "");
    atualizarMarcaFazenda();
}

// nome da fazenda no rodapé da barra lateral (computador) e o item
// "Fazendas" do menu, que só o dono do sistema vê
function atualizarMarcaFazenda(){
    let logado = !!obterToken();
    let marca = document.getElementById("navRodapeFazenda");
    if(marca && logado){
        let partes = nomeFazendaAtual().trim().split(/\s+/);
        let destaque = partes.length > 1 ? partes.pop() : "";
        marca.innerHTML = escaparHtmlPesagem(partes.join(" ")) + (destaque ? ` <span class="navRodapeDestaque">${escaparHtmlPesagem(destaque)}</span>` : "");
    }
    let slogan = document.getElementById("navRodapeSlogan");
    if(slogan) slogan.style.display = (!logado || schemaDoTokenLocal(obterToken()) === "public") ? "" : "none";
    let navFazendas = document.querySelector('[data-tela="telaFazendas"]');
    if(navFazendas) navFazendas.style.display = (logado && ehDonoSistemaLocal()) ? "" : "none";
}

// sessões abertas antes desta versão não têm o nome da fazenda guardado
async function atualizarDadosFazendaDoServidor(){
    let token = obterToken();
    if(!token || typeof API_URL === "undefined") return;
    try{
        let resp = await fetch(`${API_URL}/api/auth/me`, { headers: { "Authorization": "Bearer " + token } });
        if(resp.ok) guardarDadosFazenda(await resp.json());
    }catch(e){}
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
        if(!prepararDadosLocaisParaFazenda(dados.token)){
            fetch(`${API_URL}/api/auth/logout`, { method: "POST", headers: { "Authorization": "Bearer " + dados.token } }).catch(() => {});
            mostrarErro("Entrada cancelada.");
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
        localStorage.setItem("permEditarNascimentos", dados.permissaoEditarNascimentos ? "1" : "");
        guardarDadosFazenda(dados);
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
    localStorage.removeItem("permEditarNascimentos");
    localStorage.removeItem("produtosCache");
    localStorage.removeItem("pastosCache");
    localStorage.removeItem("fazendaNome");
    localStorage.removeItem("fazendaId");
    localStorage.removeItem("donoSistema");
    limparDadosVisiveis();
    atualizarBotaoLogin();
    aplicarRestricoesUsuario();
    atualizarStatusSync("👤 Não conectado");
    mostrarTelaLogin();
}

function atualizarBotaoLogin(){
    let logado = !!obterToken();

    let btn = document.getElementById("btnLoginLogout");
    let nome = obterUsuarioLogado();
    if(btn){
        // no menu novo do celular esse botão virou um círculo pequeno
        // (.pillPerfil) sem espaço pra texto -- só no gerenciamento
        // (desktop) que ele mostra "Sair (Nome)" por extenso.
        let ehMenuMobile = !!document.getElementById("telaMenu");
        if(nome){
            if(ehMenuMobile){
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>';
                btn.classList.add("pillPerfilSair");
            } else {
                btn.innerText = "🚪 Sair (" + nome + ")";
            }
            btn.onclick = sair;
        } else {
            if(ehMenuMobile){
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
                btn.classList.remove("pillPerfilSair");
            } else {
                btn.innerText = "👤 Entrar";
            }
            btn.onclick = mostrarTelaLogin;
        }
    }

    // saudação do Dashboard ("Olá, <nome>!") -- só existe no admin.html
    let saudacao = document.getElementById("saudacaoNome");
    if(saudacao && nome) saudacao.innerText = nome;
    atualizarMarcaFazenda();

    // Nav do gerenciamento (desktop): cada botão só aparece se o usuário
    // estiver logado, e Usuários/Lotes exigem também o papel admin.
    [
        { id: "telaDashboard", soAdmin: false },
        { id: "telaResultado", soAdmin: false },
        { id: "telaUsuarios", soAdmin: true },
        { id: "telaLotes", soAdmin: true },
        { id: "telaAlmoxarifado", soAdmin: true },
        { id: "telaPatrimonio", soAdmin: true },
        { id: "telaFluxoCaixa", soAdmin: true },
        { id: "telaContasPagar", soAdmin: true },
        { id: "telaEnergia", soAdmin: true },
        { id: "telaSalarios", soAdmin: true },
        { id: "telaVacasMatriz", soAdmin: true }
    ].forEach(({ id, soAdmin }) => {
        let navBtn = document.querySelector(`[data-tela="${id}"]`);
        if(!navBtn) return;
        let podeVer = logado && (!soAdmin || obterPapelLogado() === "admin");
        navBtn.style.display = podeVer ? "" : "none";
    });

    // Botão de Saída de Almoxarifado no menu do celular: só aparece pra admin
    // ou pra quem o admin autorizou especificamente (permissaoAlmoxarifado).
    let btnAlmoxMenu = document.getElementById("btnMenuAlmoxarifado");
    if(btnAlmoxMenu){
        let podeAlmoxarifado = logado && (obterPapelLogado() === "admin" || obterPermAlmoxarifado());
        btnAlmoxMenu.style.display = podeAlmoxarifado ? "flex" : "none";
    }

    // Botão de Vacas Matriz no menu do celular: mesma lógica — admin ou
    // quem o admin autorizou especificamente (permissaoVacasMatriz).
    let btnVacasMenu = document.getElementById("btnMenuVacasMatriz");
    if(btnVacasMenu){
        let podeVacasMatriz = logado && (obterPapelLogado() === "admin" || obterPermVacasMatriz());
        btnVacasMenu.style.display = podeVacasMatriz ? "flex" : "none";
    }
}

// ========================================
// RESUMO "HOJE" DO MENU (celular)
// ========================================
// conta quantos itens de uma lista têm a data (campo "dd/mm/yyyy, hh:mm:ss")
// igual à data de hoje -- mesmo formato usado em todo o sistema.
function contarHojeBR(lista, campoData){
    let hojeBR = new Date().toLocaleDateString("pt-BR");
    return (lista || []).filter(item => {
        let d = String(item[campoData] || "").split(",")[0].trim();
        return d === hojeBR;
    }).length;
}

function formatarTendenciaHoje(qtd){
    return qtd > 0 ? `↑ +${qtd}` : "— 0";
}

// Pesagens/Vendas vêm do array `relatorios` (já carregado pelo sync).
// Saídas de Produtos vêm do localStorage, mesma fonte que a tela de Saída
// de Produtos usa antes de sincronizar. Vacas Matriz é a única que precisa
// de uma busca no servidor (não fica em cache local no celular) -- e só
// roda se o usuário tiver permissão, mesma regra que já esconde/mostra o
// botão do menu, pra não gastar uma chamada de rede à toa.
async function atualizarResumoHojeMenu(){
    let pesagensHoje = contarHojeBR(relatorios, "data");
    let elPesagens = document.getElementById("hojePesagens");
    if(elPesagens) elPesagens.innerText = String(pesagensHoje);

    let hojeBR = new Date().toLocaleDateString("pt-BR");
    let vendasHoje = (relatorios || []).filter(r => {
        let d = String(r.data || "").split(",")[0].trim();
        return d === hojeBR && (r.tipo || "venda") === "venda";
    }).length;
    let elVendas = document.getElementById("hojeVendas");
    if(elVendas) elVendas.innerText = String(vendasHoje);

    // "Pesagens"/"Vendas" contam REGISTROS (cada um pode ter vários animais
    // dentro de pesos[]) -- essas duas somam a quantidade de ANIMAIS de
    // fato, uma métrica diferente e complementar
    let animaisPesadosHoje = (relatorios || []).filter(r => {
        let d = String(r.data || "").split(",")[0].trim();
        return d === hojeBR;
    }).reduce((soma, r) => soma + (r.pesos ? r.pesos.length : 0), 0);
    let elAnimaisPesados = document.getElementById("hojeAnimaisPesados");
    if(elAnimaisPesados) elAnimaisPesados.innerText = String(animaisPesadosHoje);

    let animaisVendidosHoje = (relatorios || []).filter(r => {
        let d = String(r.data || "").split(",")[0].trim();
        return d === hojeBR && (r.tipo || "venda") === "venda";
    }).reduce((soma, r) => soma + (r.pesos ? r.pesos.length : 0), 0);
    let elAnimaisVendidos = document.getElementById("hojeAnimaisVendidos");
    if(elAnimaisVendidos) elAnimaisVendidos.innerText = String(animaisVendidosHoje);

    let saidas = JSON.parse(localStorage.getItem("estoqueSaidas") || "[]");
    let saidasHoje = contarHojeBR(saidas, "data");
    let elSaidas = document.getElementById("hojeSaidas");
    if(elSaidas) elSaidas.innerText = String(saidasHoje);

    let podeVacas = !!obterToken() && (obterPapelLogado() === "admin" || obterPermVacasMatriz());
    let blocoVacas = document.getElementById("hojeBlocoVacas");
    if(blocoVacas) blocoVacas.style.display = podeVacas ? "flex" : "none";
    let blocoNascimentos = document.getElementById("hojeBlocoNascimentos");
    if(blocoNascimentos) blocoNascimentos.style.display = podeVacas ? "flex" : "none";
    let blocoApartar = document.getElementById("hojeBlocoApartar");
    if(blocoApartar) blocoApartar.style.display = podeVacas ? "flex" : "none";
    if(!podeVacas) return;

    try{
        let token = obterToken();
        let headers = { "Authorization": "Bearer " + token };
        let [respVacas, respNasc] = await Promise.all([
            fetch(`${API_URL}/api/vacas-matriz`, { headers }),
            fetch(`${API_URL}/api/nascimentos`, { headers })
        ]);
        if(respVacas.ok){
            let vacas = await respVacas.json();
            let ativas = vacas.filter(v => v.status === "ativa").length;
            let elVacasTotal = document.getElementById("hojeVacasTotal");
            if(elVacasTotal) elVacasTotal.innerText = String(ativas);
        }
        if(respNasc.ok){
            let nascimentos = await respNasc.json();
            let nascidosHoje = contarHojeBR(nascimentos, "dataNascimento");
            let elTendencia = document.getElementById("hojeVacasTendencia");
            if(elTendencia){
                elTendencia.innerText = formatarTendenciaHoje(nascidosHoje);
                elTendencia.classList.toggle("subiu", nascidosHoje > 0);
            }
            let elNascimentos = document.getElementById("hojeNascimentos");
            if(elNascimentos) elNascimentos.innerText = String(nascidosHoje);

            // reaproveita o mesmo aviso já usado na lista de Vacas Matriz
            // (8-12 meses = "pronto", 12+ = "atrasado") -- aqui só conta
            // quantos bezerros vivos estão em qualquer um dos dois casos,
            // ou seja, já deveriam ter sido apartados até hoje e não foram
            let bezerrosProntos = nascimentos.filter(n => avisoApartacaoNascimento(n) !== null).length;
            let elApartar = document.getElementById("hojeBezerrosApartar");
            if(elApartar) elApartar.innerText = String(bezerrosProntos);
        }
    } catch(e){
        // resumo é só informativo -- se a rede falhar, o menu continua
        // funcionando normalmente, só sem esse cartão atualizado
    }
}

// ========================================
// MENSAGENS (sininho do menu, celular)
// ========================================
let mensagensCacheMobile = [];

async function carregarMensagensMobile(){
    let token = obterToken();
    if(!token) return [];
    try{
        let resp = await fetch(`${API_URL}/api/mensagens`, { headers: { "Authorization": "Bearer " + token } });
        if(!resp.ok) return [];
        mensagensCacheMobile = await resp.json();
        return mensagensCacheMobile;
    } catch(e){
        return [];
    }
}

async function atualizarBadgeMensagens(){
    await carregarMensagensMobile();
    let badge = document.getElementById("badgeMensagens");
    if(!badge) return;
    let naoLidas = mensagensCacheMobile.filter(m => !m.lida).length;
    if(naoLidas > 0){
        badge.innerText = naoLidas > 9 ? "9+" : String(naoLidas);
        badge.style.display = "flex";
    } else {
        badge.style.display = "none";
    }
}

async function abrirTelaMensagensMobile(){
    await carregarMensagensMobile();
    mostrarMensagensMobile();
}

function mostrarMensagensMobile(){
    let corpo = document.getElementById("listaMensagensMobile");
    if(!corpo) return;
    if(mensagensCacheMobile.length === 0){
        corpo.innerHTML = `<p class="loginSubtitulo">Nenhuma mensagem recebida ainda.</p>`;
        return;
    }
    corpo.innerHTML = mensagensCacheMobile.map(m => `
        <div class="itemMensagem${m.lida ? "" : " itemMensagemNaoLida"}" onclick="marcarMensagemLidaMobile('${m.id}')">
            <div class="itemMensagemTopo">
                <strong>${escaparHtmlPesagem(m.criadoPor || "Administração")}</strong>
                <span>${m.criadoEm ? new Date(m.criadoEm).toLocaleString("pt-BR") : ""}</span>
            </div>
            <p>${escaparHtmlPesagem(m.texto)}</p>
        </div>
    `).join("");
}

async function marcarMensagemLidaMobile(id){
    let msg = mensagensCacheMobile.find(m => m.id === id);
    if(!msg || msg.lida) return;
    msg.lida = true;
    mostrarMensagensMobile();
    atualizarBadgeMensagens();
    try{
        let token = obterToken();
        await fetch(`${API_URL}/api/mensagens/${id}/marcar-lida`, { method: "POST", headers: { "Authorization": "Bearer " + token } });
    } catch(e){
        // já marcou visualmente -- se a chamada falhar, na próxima
        // sincronização/abertura da tela o servidor corrige sozinho
    }
}

function carregarLotesSelect(){
    let lotes = JSON.parse(localStorage.getItem("lotesCache") || "[]");
    let opcoes = `<option value="">Sem lote</option>` +
        lotes.map(l => {
            let saldo = saldoLoteLocal(l.nome);
            let rotulo = saldo === null ? l.nome : `${l.nome} — ${saldo} ${saldo === 1 ? "animal" : "animais"}`;
            return `<option value="${l.nome.replace(/"/g, "&quot;")}">${rotulo}</option>`;
        }).join("");
    // preenche o select do Critério 1 e também os dos Critérios 2/3 (só
    // existem no DOM se o operador tiver aberto esses blocos extras)
    ["descricao", "descricao2", "descricao3"].forEach(id => {
        let select = document.getElementById(id);
        if(!select) return;
        let valorAtual = select.value;
        select.innerHTML = opcoes;
        select.value = valorAtual;
    });
    let destino = document.getElementById("loteDestinoTransf");
    if(destino){
        let valorAtual = destino.value;
        destino.innerHTML = `<option value="">Selecione o lote</option>` + opcoes.replace(`<option value="">Sem lote</option>`, "");
        destino.value = valorAtual;
    }
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
        produtos.map(p => `<option value="${p.id}">${escaparHtmlPesagem(p.descricao)}</option>`).join("");
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

    // desconta do cache local na hora -- sem isso, uma segunda saída do
    // mesmo produto na mesma sessão (antes da sincronização confirmar a
    // primeira) via preview/estoque disponível desatualizado, deixando o
    // operador lançar mais saída do que realmente existe no almoxarifado.
    let produtos = JSON.parse(localStorage.getItem("produtosCache") || "[]");
    let produtoAtualizado = produtos.find(p => p.id === produtoId);
    if(produtoAtualizado) produtoAtualizado.saldoAtual = Math.max(0, (produtoAtualizado.saldoAtual || 0) - quantidade);
    localStorage.setItem("produtosCache", JSON.stringify(produtos));

    alert("Saída registrada! Assim que sincronizar, o estoque é atualizado.");
    document.getElementById("saidaMobQuantidadeInput").value = "";
    if(erroEl){ erroEl.style.display = "none"; erroEl.innerText = ""; }
    carregarProdutosSelectMobile();
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

// ========================================
// SINCRONIZAÇÃO NO CAMPO (sem internet / sinal fraco)
// ========================================
// Tudo é salvo primeiro no aparelho; a sincronização só envia/baixa. No
// curral o caso comum NÃO é "sem internet" (aí o evento "online" resolve),
// é sinal fraco: o celular diz que está conectado mas nada passa. Antes,
// um envio que falhava só era tentado de novo ao salvar outra pesagem ou
// reabrir o app. Agora: nova tentativa a cada 30s enquanto houver algo
// guardado, ao voltar pro app, tempo-limite por pedido (pra não ficar
// travado num sinal morto) e nunca duas sincronizações ao mesmo tempo.
const SYNC_TEMPO_LIMITE_MS = 30000;
const SYNC_RETENTATIVA_MS = 30000;

function quantidadeAguardandoEnvio(){
    let total = 0;
    ["pesagens", "estoqueSaidas", "nascimentos", "vacasMatriz"].forEach(chave => {
        try{
            let lista = JSON.parse(localStorage.getItem(chave) || "[]");
            if(Array.isArray(lista)) total += lista.filter(item => item && !item.sincronizado && !item.avisoSaldo).length;
        }catch(e){}
    });
    ["exclusoesPendentes", "transferenciasPendentes", "despesasFretePendentes"].forEach(chave => {
        try{ total += (JSON.parse(localStorage.getItem(chave) || "[]") || []).length; }catch(e){}
    });
    return total;
}

function textoGuardadosNoAparelho(){
    let n = quantidadeAguardandoEnvio();
    return n > 0 ? ` — ${n} registro(s) guardado(s) no aparelho` : "";
}

// A sincronização demora (rede) e, enquanto isso, o operador pode salvar
// outra pesagem -- e uma pesagem com 2-3 critérios salva um registro por
// critério, cada um disparando a sincronização. Por isso ela NUNCA grava de
// volta a cópia que leu no começo: sempre relê a lista ATUAL do aparelho e
// só marca como enviado o que foi enviado de fato. (Gravar a cópia antiga
// apagava do aparelho o que foi salvo no meio do caminho -- perda real de
// pesagens de 2º/3º critério.)
function marcarEnviadosNoAparelho(chave, idsAceitos, extra){
    let aceitos = new Set(idsAceitos);
    let atual = JSON.parse(localStorage.getItem(chave) || "[]");
    atual.forEach(item => {
        if(!item) return;
        if(aceitos.has(item.id)) item.sincronizado = true;
        if(extra) extra(item);
    });
    localStorage.setItem(chave, JSON.stringify(atual));
    return atual;
}

// junta o que veio do servidor com o que AINDA não subiu deste aparelho,
// lendo o aparelho na hora (não a cópia do começo da sincronização)
function mesclarComServidor(chave, doServidor, ignorarIds){
    let ignorar = new Set(ignorarIds || []);
    let mapa = {};
    doServidor.forEach(x => { mapa[x.id] = Object.assign({}, x, { sincronizado: true }); });
    JSON.parse(localStorage.getItem(chave) || "[]").forEach(x => {
        if(x && !x.sincronizado && x.id && !ignorar.has(x.id)) mapa[x.id] = x;
    });
    ignorar.forEach(id => { delete mapa[id]; });
    let lista = Object.values(mapa);
    localStorage.setItem(chave, JSON.stringify(lista));
    return lista;
}

// filas (exclusões, transferências, fretes): tira só o que foi processado,
// relendo a fila atual -- o que entrou nela durante o envio continua lá
function tirarDaFila(chave, lidos, restantes, idDe){
    idDe = idDe || (x => x);
    let ficaram = new Set(restantes.map(idDe));
    let processados = new Set(lidos.map(idDe).filter(id => !ficaram.has(id)));
    let atual = JSON.parse(localStorage.getItem(chave) || "[]");
    localStorage.setItem(chave, JSON.stringify(atual.filter(x => !processados.has(idDe(x)))));
}

let sincronizacaoEmAndamento = null;
let sincronizarDeNovoAoTerminar = false;
async function sincronizarAgora(){
    if(sincronizacaoEmAndamento){
        sincronizarDeNovoAoTerminar = true;
        return sincronizacaoEmAndamento;
    }
    sincronizacaoEmAndamento = (async () => {
        try{ await sincronizarUmaVez(); }
        finally{ sincronizacaoEmAndamento = null; }
    })();
    await sincronizacaoEmAndamento;
    if(sincronizarDeNovoAoTerminar){
        sincronizarDeNovoAoTerminar = false;
        return sincronizarAgora();
    }
}

async function sincronizarUmaVez(){
    // tempo-limite em todo pedido desta sincronização
    const fetch = (url, opcoes) => window.fetch(url, { ...(opcoes || {}), signal: AbortSignal.timeout(SYNC_TEMPO_LIMITE_MS) });
    let token = obterToken();
    if(!token){
        atualizarStatusSync("⚠️ Toque em Entrar pra ativar a sincronização");
        return;
    }
    if(!navigator.onLine){
        atualizarStatusSync("📴 Sem internet" + textoGuardadosNoAparelho() + ". Envia sozinho quando voltar.");
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
            // recusada por saldo (ex: outro celular vendeu do mesmo lote antes)
            // -- fica guardada aqui sem sincronizar; avisa uma vez só
            (respostaSync.rejeitadasSaldo || []).forEach(x => {
                let r = lista.find(p => p.id === x.id);
                if(!r || r.avisoSaldo) return;
                r.avisoSaldo = true;
                alert(`A ${(r.tipo || "venda") === "compra" ? "compra" : "venda"} de ${x.quantidade} animal(is) do lote "${x.lote}" não foi aceita pelo servidor: o lote só tem ${x.saldo} animal(is) no saldo. Ela ficou guardada neste aparelho sem sincronizar — confira em Relatórios e exclua ou corrija.`);
            });
            // só marca como sincronizado o que o servidor realmente aceitou —
            // um HTTP 200 não significa que TODOS os registros do lote foram
            // gravados, já que o servidor descarta silenciosamente pesagens
            // de um tipo que o usuário não tem permissão de lançar
            let comAvisoSaldo = new Set(naoSincronizados.filter(r => r.avisoSaldo).map(r => r.id));
            marcarEnviadosNoAparelho("pesagens",
                naoSincronizados.filter(r => !idsRejeitadosPermissao.includes(r.id)).map(r => r.id),
                item => { if(comAvisoSaldo.has(item.id)) item.avisoSaldo = true; });
        }

        let exclusoesPendentes = JSON.parse(localStorage.getItem("exclusoesPendentes") || "[]");
        let exclusoesLidas = [...exclusoesPendentes];
        for(let id of [...exclusoesPendentes]){
            let respDel = await fetch(`${API_URL}/api/pesagens/${id}`, {
                method: "DELETE",
                headers: { "Authorization": "Bearer " + token }
            });
            if(respDel.ok){
                exclusoesPendentes = exclusoesPendentes.filter(x => x !== id);
            } else if(respDel.status === 400){
                // recusada (ex: compra cujos animais já saíram do lote) -- a
                // pesagem volta na próxima leitura do servidor
                let erro = (await respDel.json().catch(() => ({}))).erro || "exclusão recusada pelo servidor";
                exclusoesPendentes = exclusoesPendentes.filter(x => x !== id);
                alert(erro);
            }
        }
        tirarDaFila("exclusoesPendentes", exclusoesLidas, exclusoesPendentes);

        // transferências pesadas no celular -- depois das pesagens, porque o
        // servidor confere se o lote de origem tem animais suficientes
        let transfPendentes = JSON.parse(localStorage.getItem("transferenciasPendentes") || "[]");
        let transfLidas = [...transfPendentes];
        for(let t of [...transfPendentes]){
            let respT = await fetch(`${API_URL}/api/transferencias-lotes`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify(t)
            });
            if(respT.ok){
                transfPendentes = transfPendentes.filter(x => x.id !== t.id);
            } else if(respT.status === 400 || respT.status === 403){
                // recusada (ex: o lote de origem não tem tantos animais) -- não
                // adianta tentar de novo; guarda os pesos e avisa
                let erro = (await respT.json().catch(() => ({}))).erro || "recusada pelo servidor";
                transfPendentes = transfPendentes.filter(x => x.id !== t.id);
                let recusadas = JSON.parse(localStorage.getItem("transferenciasRecusadas") || "[]");
                recusadas.push({ ...t, erro });
                localStorage.setItem("transferenciasRecusadas", JSON.stringify(recusadas));
                alert(`A transferência de ${t.quantidade} animal(is) de "${t.loteOrigem}" para "${t.loteDestino}" não foi aceita: ${erro}`);
            }
        }
        tirarDaFila("transferenciasPendentes", transfLidas, transfPendentes, x => x.id);

        // fretes lançados ao finalizar uma compra
        let fretesPendentes = JSON.parse(localStorage.getItem("despesasFretePendentes") || "[]");
        let fretesLidos = [...fretesPendentes];
        for(let f of [...fretesPendentes]){
            let respF = await fetch(`${API_URL}/api/despesas-frete`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify(f)
            });
            if(respF.ok){
                fretesPendentes = fretesPendentes.filter(x => x.id !== f.id);
            } else if(respF.status === 400){
                let erroFrete = (await respF.json().catch(() => ({}))).erro || "recusado pelo servidor";
                fretesPendentes = fretesPendentes.filter(x => x.id !== f.id);
                alert(`O frete de R$ ${formatarMoeda(f.valor)} não foi aceito: ${erroFrete}`);
            }
        }
        tirarDaFila("despesasFretePendentes", fretesLidos, fretesPendentes, x => x.id);

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
                    marcarEnviadosNoAparelho("estoqueSaidas", naoSincronizadasSaidas.filter(x => !idsRejeitadosSaidas.includes(x.id)).map(x => x.id));
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
                    marcarEnviadosNoAparelho("vacasMatriz", naoSincronizadasVacas.filter(v => !idsRejeitadosVacas.includes(v.id)).map(v => v.id));
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
                    marcarEnviadosNoAparelho("nascimentos", naoSincronizadosNascimentos.filter(n => !idsRejeitadosNascimentos.includes(n.id)).map(n => n.id));
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
                mesclarComServidor("vacasMatriz", vacasDoServidor);
            }
            let respNascGet = await fetch(`${API_URL}/api/nascimentos`, { headers: { "Authorization": "Bearer " + token } });
            if(respNascGet.ok){
                let nascimentosDoServidor = await respNascGet.json();
                mesclarComServidor("nascimentos", nascimentosDoServidor);
            }
            if(typeof mostrarVacasMatrizMobile === "function") mostrarVacasMatrizMobile();
        }

        // exclusões feitas DURANTE a sincronização também valem
        let exclusoesAgora = JSON.parse(localStorage.getItem("exclusoesPendentes") || "[]");
        relatorios = mesclarComServidor("pesagens", doServidor, exclusoesAgora);

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
            atualizarStatusSync("❌ Erro ao sincronizar (" + e.message + ")");
        } else if(e.name === "TypeError" || e.name === "AbortError" || e.name === "TimeoutError"){
            // falha de rede (sinal fraco): nada se perde, tenta de novo sozinho
            atualizarStatusSync("📶 Sinal fraco" + textoGuardadosNoAparelho() + ". Envia sozinho quando melhorar.");
        } else {
            atualizarStatusSync("❌ Erro ao sincronizar (" + e.message + ")");
        }
    }
}

window.addEventListener("online", () => sincronizarAgora());
// voltou pro app (estava no WhatsApp, tela apagada...) -- sincroniza
document.addEventListener("visibilitychange", () => {
    if(document.visibilityState === "visible" && obterToken()) sincronizarAgora();
});
// enquanto tiver algo guardado no aparelho, tenta de novo a cada 30s
setInterval(() => {
    if(document.visibilityState === "visible" && obterToken() && navigator.onLine && quantidadeAguardandoEnvio() > 0){
        sincronizarAgora();
    }
}, SYNC_RETENTATIVA_MS);

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
    atualizarDadosFazendaDoServidor();

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
    somClique();
}

function digitarMeio(){
    let display = document.getElementById("displayPeso");

    if(!display) return;
    if(display.value === "" || display.value.includes(",")) return;

    display.value += ",5";
    somClique();
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
// BALANÇA BLUETOOTH (indicador Prix Rebanho / Toledo, via BLE)
// ========================================
// A balança manda repetidamente um "cartão" de texto fragmentado em vários
// pacotes BLE (o limite de tamanho de cada notificação obriga a quebrar em
// pedaços), mais ou menos assim:
//   PID:  ...  \r\nID: ...  \r\nEID: ...  \r\nPESO:  139.5kg\r\n
// A estratégia aqui é simples e resistente a pacote perdido/cortado: junta
// tudo num buffer contínuo (com um teto de tamanho, pra não crescer pra
// sempre) e sempre procura a ÚLTIMA ocorrência de "PESO: <número>kg" nele —
// não depende de saber onde cada pacote começa/termina.
// Só existe no Android via Chrome -- o Safari do iPhone não implementa Web
// Bluetooth e não tem contorno possível (ver balancaBluetoothDisponivel).
const BALANCA_SERVICO_UUID = "569a1101-b87f-490c-92cb-11ba5ea5167c";
const BALANCA_CARACTERISTICA_UUID = "569a2000-b87f-490c-92cb-11ba5ea5167c";
// abaixo disso considera que não tem bicho em cima (balança vazia/ruído) --
// libera a próxima captura automática
const BALANCA_LIMIAR_MINIMO_KG = 5;
// variação máxima entre leituras seguidas pra ainda contar como "o mesmo peso"
const BALANCA_TOLERANCIA_ESTABILIDADE_KG = 0.5;
// tempo que o peso precisa ficar parado nesse valor antes de lançar sozinho
// na lista -- evita pegar o animal ainda subindo/se mexendo na balança
const BALANCA_JANELA_ESTABILIDADE_MS = 1200;
// O indicador Prix só transmite depois de TRAVAR um peso (1 cartão por
// pesagem, confirmado no log de campo) -- então um peso diferente do último
// lançado é outro animal e lança sozinho. Antes isso exigia mais de 3kg de
// diferença, e animais de peso parecido no mesmo lote (250 → 252) apareciam
// no display mas não lançavam. Agora só um peso IDÊNTICO ao último lançado
// fica de fora (pode ser o mesmo cartão repetido) -- nesse caso o app avisa
// e o operador confirma no "Lançar", nunca lança duplicado sozinho.
const BALANCA_DIFERENCA_PESO_IGUAL_KG = 0.25;
// logo depois de reconectar, o indicador pode reenviar o último peso que
// estava travado -- ignora em silêncio se for igual ao último lançado
const BALANCA_JANELA_POS_RECONEXAO_MS = 6000;
// tentativas de reconexão automática: 1s, 2s, 4s, 8s e depois a cada 10s,
// enquanto a pesagem estiver aberta
const BALANCA_ESPERAS_RECONEXAO_MS = [1000, 2000, 4000, 8000, 10000];
// gatt.connect() às vezes fica pendurado pra sempre no Android quando a
// balança está fora de alcance -- desiste dessa tentativa depois disso
const BALANCA_TIMEOUT_CONEXAO_MS = 10000;
// o evento de desconexão nem sempre chega no Android -- confere de tempos
// em tempos se a conexão ainda está de pé
const BALANCA_INTERVALO_VERIFICACAO_MS = 4000;

let balancaDevice = null;
let balancaCaracteristica = null;
let balancaBuffer = "";
// true quando a desconexão foi pedida pelo app (finalizar/cancelar/voltar)
// -- aí NÃO tenta reconectar
let balancaDesconexaoIntencional = true;
let balancaReconectando = false;
let balancaTentativasReconexao = 0;
let balancaTimerReconexao = null;
let balancaTimerVerificacao = null;
let balancaReconectadoEm = 0;
let balancaWakeLock = null;
let balancaTimerAvisoTemporario = null;
// último peso que entrou na lista (pela balança OU digitado/"Lançar") --
// é o que decide se uma leitura nova é outro animal ou repetição
let balancaUltimoValorCapturado = null;
let balancaValorReferencia = null;
let balancaTimerEstabilidade = null;
let balancaLancamentoAutomaticoEmCurso = false;
// log de diagnóstico ao vivo (botão 🔍 na tela de pesagem) -- guarda os
// últimos eventos da balança com hora exata, pra investigar de longe
let balancaLogEntradas = [];

function logBalanca(msg){
    let hora = new Date().toLocaleTimeString("pt-BR") + "." + String(new Date().getMilliseconds()).padStart(3, "0");
    balancaLogEntradas.push(hora + " " + msg);
    if(balancaLogEntradas.length > 40) balancaLogEntradas.shift();
    renderizarLogBalanca();
}

function renderizarLogBalanca(){
    let box = document.getElementById("logBalancaBox");
    if(!box || box.style.display === "none") return;
    box.textContent = balancaLogEntradas.join("\n");
    box.scrollTop = box.scrollHeight;
}

function alternarLogBalanca(){
    let box = document.getElementById("logBalancaBox");
    if(!box) return;
    box.style.display = box.style.display === "none" ? "block" : "none";
    if(box.style.display === "block") renderizarLogBalanca();
}

function balancaBluetoothDisponivel(){
    return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

// sessão de balança aberta = conectou nessa pesagem e ninguém mandou
// desconectar (mesmo que a conexão tenha caído e esteja reconectando)
function balancaSessaoAtiva(){
    return !!balancaDevice && !balancaDesconexaoIntencional;
}

function telaPesagemAtiva(){
    let tela = document.getElementById("telaPesagem");
    return !!tela && tela.classList.contains("ativa");
}

function atualizarStatusConexaoBalanca(texto, classe){
    let el = document.getElementById("statusConexaoBalanca");
    if(!el) return;
    el.textContent = texto;
    el.className = "statusConexaoBalanca" + (classe ? " " + classe : "");
}

function pularConexaoBalanca(){
    trocarTela("telaPesagem");
    atualizarStats();
}

function voltarDeConectarBalanca(){
    desconectarBalancaBluetooth();
    trocarTela("telaInicial");
}

// a linha "PESO ATUAL" em cima do display vira o status da balança:
// conectada / reconectando / desconectada (toque pra reconectar) / avisos
// rápidos (lançado automático, peso igual ao anterior)
function atualizarIndicadorBalanca(estado, texto){
    let label = document.getElementById("pesoAtualLabel");
    if(!label) return;
    let textos = {
        off: "PESO ATUAL",
        conectada: "● BALANÇA CONECTADA",
        reconectando: "↻ RECONECTANDO…",
        desconectada: "⚠ BALANÇA CAIU · TOQUE AQUI",
        lancado: "✓ LANÇADO AUTOMÁTICO",
        igual: "PESO REPETIDO · CONFIRME ↓"
    };
    label.textContent = texto || textos[estado] || textos.off;
    label.className = "pesoAtualLabel" + (estado && estado !== "off" ? " balanca-" + estado : "");
    // compatibilidade com o verde "ao vivo" que já existia
    if(estado === "conectada" || estado === "lancado") label.classList.add("aoVivo");
    let btnLancar = document.querySelector(".btnLancar");
    if(btnLancar) btnLancar.classList.toggle("btnLancarPulsando", estado === "igual");
}

// aviso que some sozinho e volta pro status normal da conexão
function mostrarAvisoTemporarioBalanca(estado, ms){
    if(balancaTimerAvisoTemporario) clearTimeout(balancaTimerAvisoTemporario);
    atualizarIndicadorBalanca(estado);
    balancaTimerAvisoTemporario = setTimeout(() => {
        balancaTimerAvisoTemporario = null;
        atualizarIndicadorBalancaPelaConexao();
    }, ms);
}

function atualizarIndicadorBalancaPelaConexao(){
    if(!balancaSessaoAtiva()) return atualizarIndicadorBalanca("off");
    if(balancaDevice.gatt && balancaDevice.gatt.connected && balancaCaracteristica) return atualizarIndicadorBalanca("conectada");
    // as primeiras tentativas aparecem como "reconectando"; depois de 3
    // falhas vira "desconectada, toque pra reconectar" (vermelho), mas o app
    // continua tentando sozinho a cada 10s por trás
    if(balancaConexaoEmAndamento || balancaTentativasReconexao < 3){
        atualizarIndicadorBalanca("reconectando", balancaTentativasReconexao > 1 ? `↻ RECONECTANDO… (${balancaTentativasReconexao})` : "");
    }else{
        atualizarIndicadorBalanca("desconectada");
    }
}

// toque na linha de status da tela de pesagem
function tocarStatusBalanca(){
    if(!balancaSessaoAtiva()) return;
    if(balancaDevice.gatt.connected && balancaCaracteristica) return;
    logBalanca("operador pediu reconexão");
    balancaTentativasReconexao = 0;
    tentarReconectarBalanca();
}

// mantém a tela do celular acesa durante a pesagem com balança -- com a
// tela apagada o Android pode suspender o Chrome e derrubar o Bluetooth
async function manterTelaLigadaBalanca(){
    try{
        if(!("wakeLock" in navigator) || balancaWakeLock || document.visibilityState !== "visible") return;
        balancaWakeLock = await navigator.wakeLock.request("screen");
        balancaWakeLock.addEventListener("release", () => { balancaWakeLock = null; });
    }catch(e){
        logBalanca("tela ligada indisponível: " + e.message);
    }
}

function liberarTelaLigadaBalanca(){
    if(balancaWakeLock){
        balancaWakeLock.release().catch(() => {});
        balancaWakeLock = null;
    }
}

document.addEventListener("visibilitychange", () => {
    if(document.visibilityState !== "visible" || !balancaSessaoAtiva()) return;
    manterTelaLigadaBalanca();
    verificarConexaoBalanca();
});

function comTimeoutBalanca(promessa, ms){
    return new Promise((resolve, reject) => {
        let timer = setTimeout(() => reject(new Error("tempo de conexão esgotado")), ms);
        promessa.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
    });
}

// conecta no GATT e assina as notificações de peso -- usada tanto na
// primeira conexão quanto em cada reconexão (o objeto do dispositivo é o
// mesmo, então reconectar NÃO precisa abrir a janela de escolha de novo)
async function abrirConexaoGattBalanca(){
    let server;
    try{
        server = await comTimeoutBalanca(balancaDevice.gatt.connect(), BALANCA_TIMEOUT_CONEXAO_MS);
    }catch(e){
        try{ balancaDevice.gatt.disconnect(); }catch(_){}
        throw e;
    }
    let servico = await server.getPrimaryService(BALANCA_SERVICO_UUID);
    let caracteristica = await servico.getCharacteristic(BALANCA_CARACTERISTICA_UUID);
    if(balancaCaracteristica && balancaCaracteristica !== caracteristica){
        balancaCaracteristica.removeEventListener("characteristicvaluechanged", processarNotificacaoBalanca);
    }
    // listener ANTES de ligar as notificações, pra não perder o 1º pacote
    // (addEventListener com a mesma função não duplica)
    caracteristica.addEventListener("characteristicvaluechanged", processarNotificacaoBalanca);
    await caracteristica.startNotifications();
    balancaCaracteristica = caracteristica;
    balancaBuffer = "";
}

async function conectarBalancaBluetooth(){
    let botao = document.getElementById("btnConectarBalancaTela");
    if(!balancaBluetoothDisponivel()){
        alert("Este celular não suporta conexão direta com a balança (funciona no Android, pelo Chrome).");
        return;
    }
    try{
        if(botao) botao.disabled = true;
        atualizarStatusConexaoBalanca("Procurando...", "conectando");

        let device = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: "Prix" }],
            optionalServices: [BALANCA_SERVICO_UUID]
        });
        if(balancaDevice && balancaDevice !== device){
            balancaDevice.removeEventListener("gattserverdisconnected", onBalancaBluetoothDesconectada);
        }
        balancaDevice = device;
        balancaDevice.addEventListener("gattserverdisconnected", onBalancaBluetoothDesconectada);
        balancaDesconexaoIntencional = false;
        cancelarReconexaoBalanca();

        atualizarStatusConexaoBalanca("Conectando...", "conectando");
        await abrirConexaoGattBalanca();

        resetarEstadoCapturaBalanca();
        balancaLogEntradas = [];
        logBalanca("conectado em " + (balancaDevice.name || "balança"));
        let botaoLog = document.getElementById("btnLogBalanca");
        if(botaoLog) botaoLog.style.display = "inline";
        iniciarVerificacaoConexaoBalanca();
        manterTelaLigadaBalanca();
        atualizarIndicadorBalanca("conectada");

        atualizarStatusConexaoBalanca("✅ Conectado! Iniciando pesagem...", "conectada");
        // segurinha um instante só pra dar tempo de ver a confirmação na tela
        setTimeout(() => {
            if(document.getElementById("telaConectarBalanca").classList.contains("ativa")){
                trocarTela("telaPesagem");
                atualizarStats();
            }
        }, 700);
    }catch(e){
        if(botao) botao.disabled = false;
        // usuário cancelou a janela de escolha do dispositivo -- não é erro de verdade
        if(e.name === "NotFoundError"){
            atualizarStatusConexaoBalanca("Balança não conectada", "");
        }else{
            atualizarStatusConexaoBalanca("❌ Erro ao conectar: " + e.message, "erro");
        }
    }
}

function onBalancaBluetoothDesconectada(){
    balancaBuffer = "";
    // timer de estabilidade pendente morre junto (leitura incompleta), mas o
    // último peso lançado é mantido -- se a balança reenviar o mesmo cartão
    // ao reconectar, ele NÃO pode virar um animal duplicado
    if(balancaTimerEstabilidade){ clearTimeout(balancaTimerEstabilidade); balancaTimerEstabilidade = null; }
    balancaValorReferencia = null;

    if(!balancaSessaoAtiva()){
        atualizarIndicadorBalanca("off");
        return;
    }
    logBalanca("conexão caiu");
    let botao = document.getElementById("btnConectarBalancaTela");
    if(botao) botao.disabled = false;
    atualizarStatusConexaoBalanca("Balança não conectada", "");
    // operador continua podendo digitar na mão enquanto reconecta
    agendarReconexaoBalanca();
}

function agendarReconexaoBalanca(){
    if(!balancaSessaoAtiva() || balancaTimerReconexao || balancaConexaoEmAndamento) return;
    balancaReconectando = true;
    let espera = BALANCA_ESPERAS_RECONEXAO_MS[Math.min(balancaTentativasReconexao, BALANCA_ESPERAS_RECONEXAO_MS.length - 1)];
    atualizarIndicadorBalancaPelaConexao();
    balancaTimerReconexao = setTimeout(() => {
        balancaTimerReconexao = null;
        tentarReconectarBalanca();
    }, espera);
}

let balancaConexaoEmAndamento = false;
async function tentarReconectarBalanca(){
    if(!balancaSessaoAtiva() || balancaConexaoEmAndamento) return;
    if(balancaTimerReconexao){ clearTimeout(balancaTimerReconexao); balancaTimerReconexao = null; }
    balancaConexaoEmAndamento = true;
    balancaReconectando = true;
    balancaTentativasReconexao++;
    atualizarIndicadorBalancaPelaConexao();
    logBalanca("tentando reconectar (" + balancaTentativasReconexao + ")");
    try{
        await abrirConexaoGattBalanca();
        if(!balancaSessaoAtiva()){ try{ balancaDevice.gatt.disconnect(); }catch(_){} return; }
        balancaReconectando = false;
        balancaTentativasReconexao = 0;
        balancaReconectadoEm = Date.now();
        logBalanca("reconectado");
        atualizarIndicadorBalancaPelaConexao();
        // tom diferente do bi-bip de "peso lançado", pra não confundir
        tocarTom(1800, 0.3, "sine", 0.6);
    }catch(e){
        logBalanca("falhou: " + e.message);
        balancaConexaoEmAndamento = false;
        agendarReconexaoBalanca();
    }finally{
        balancaConexaoEmAndamento = false;
    }
}

function cancelarReconexaoBalanca(){
    if(balancaTimerReconexao){ clearTimeout(balancaTimerReconexao); balancaTimerReconexao = null; }
    balancaReconectando = false;
    balancaTentativasReconexao = 0;
}

function iniciarVerificacaoConexaoBalanca(){
    if(balancaTimerVerificacao) clearInterval(balancaTimerVerificacao);
    balancaTimerVerificacao = setInterval(verificarConexaoBalanca, BALANCA_INTERVALO_VERIFICACAO_MS);
}

// rede de segurança pro evento de desconexão que às vezes não chega
function verificarConexaoBalanca(){
    if(!balancaSessaoAtiva() || balancaReconectando || balancaConexaoEmAndamento) return;
    if(!balancaDevice.gatt.connected){
        logBalanca("verificação: conexão perdida sem aviso");
        onBalancaBluetoothDesconectada();
    }
}

function desconectarBalancaBluetooth(){
    balancaDesconexaoIntencional = true;
    cancelarReconexaoBalanca();
    if(balancaTimerVerificacao){ clearInterval(balancaTimerVerificacao); balancaTimerVerificacao = null; }
    if(balancaTimerAvisoTemporario){ clearTimeout(balancaTimerAvisoTemporario); balancaTimerAvisoTemporario = null; }
    liberarTelaLigadaBalanca();
    if(balancaCaracteristica){
        balancaCaracteristica.removeEventListener("characteristicvaluechanged", processarNotificacaoBalanca);
        balancaCaracteristica = null;
    }
    if(balancaDevice && balancaDevice.gatt.connected){
        balancaDevice.gatt.disconnect();
    }
    atualizarIndicadorBalanca("off");
}

function resetarEstadoCapturaBalanca(){
    balancaValorReferencia = null;
    balancaUltimoValorCapturado = null;
    if(balancaTimerEstabilidade){
        clearTimeout(balancaTimerEstabilidade);
        balancaTimerEstabilidade = null;
    }
}

function processarNotificacaoBalanca(event){
    let texto = new TextDecoder("utf-8").decode(event.target.value);
    logBalanca("pacote: " + JSON.stringify(texto));
    balancaBuffer += texto;

    // cada "PESO: <n>kg" completo é consumido do buffer UMA vez só -- antes
    // o buffer inteiro era relido a cada pacote e um peso antigo que ainda
    // estava nele voltava a ser processado
    let ultima = null;
    for(let m of balancaBuffer.matchAll(/PESO:\s*(\d+(?:[.,]\d+)?)\s*kg/gi)) ultima = m;
    if(!ultima){
        if(balancaBuffer.length > 400) balancaBuffer = balancaBuffer.slice(-400);
        return;
    }
    balancaBuffer = balancaBuffer.slice(ultima.index + ultima[0].length);
    let valorKg = parseFloat(ultima[1].replace(",", "."));
    if(!Number.isFinite(valorKg)) return;

    processarLeituraBalanca(valorKg);
}

// Mostra o peso ao vivo no display e lança sozinho na lista quando o valor
// fica parado um tempinho (ver tentarCapturaAutomaticaBalanca)
function processarLeituraBalanca(valorKg){
    logBalanca("=> PESO interpretado: " + valorKg + "kg");
    let display = document.getElementById("displayPeso");
    if(display) display.value = formatarPeso(valorKg);
    if(balancaTimerAvisoTemporario === null) atualizarIndicadorBalancaPelaConexao();

    if(valorKg < BALANCA_LIMIAR_MINIMO_KG){
        // balança vazia -- o próximo animal pode ter qualquer peso, até igual
        resetarEstadoCapturaBalanca();
        return;
    }

    if(balancaValorReferencia === null || Math.abs(valorKg - balancaValorReferencia) > BALANCA_TOLERANCIA_ESTABILIDADE_KG){
        // valor novo ou mudou o suficiente -- reinicia a espera de estabilidade
        balancaValorReferencia = valorKg;
        if(balancaTimerEstabilidade) clearTimeout(balancaTimerEstabilidade);
        balancaTimerEstabilidade = setTimeout(() => {
            balancaTimerEstabilidade = null;
            let valor = balancaValorReferencia;
            // libera a referência: o mesmo peso chegando de novo depois
            // (outro cartão) passa pela checagem de "igual ao anterior"
            balancaValorReferencia = null;
            tentarCapturaAutomaticaBalanca(valor);
        }, BALANCA_JANELA_ESTABILIDADE_MS);
    }
}

function algumModalAbertoPesagem(){
    return ["modalConfirmarAcao", "modalConfirmacao"].some(id => {
        let el = document.getElementById(id);
        return el && el.style.display === "flex";
    });
}

function tentarCapturaAutomaticaBalanca(valorKg){
    if(!telaPesagemAtiva()){ logBalanca("não lançou " + valorKg + "kg: fora da tela de pesagem"); return; }
    if(algumModalAbertoPesagem()){
        logBalanca("não lançou " + valorKg + "kg: tem um aviso aberto na tela");
        return;
    }
    let igualAoAnterior = balancaUltimoValorCapturado !== null
        && Math.abs(valorKg - balancaUltimoValorCapturado) < BALANCA_DIFERENCA_PESO_IGUAL_KG;
    if(igualAoAnterior){
        if(Date.now() - balancaReconectadoEm < BALANCA_JANELA_POS_RECONEXAO_MS){
            logBalanca("ignorado " + valorKg + "kg: reenvio do último peso após reconectar");
            return;
        }
        logBalanca("não lançou " + valorKg + "kg: igual ao anterior, aguardando operador");
        if(balancaTimerAvisoTemporario){ clearTimeout(balancaTimerAvisoTemporario); balancaTimerAvisoTemporario = null; }
        balancaTimerAvisoTemporario = setTimeout(() => { balancaTimerAvisoTemporario = null; atualizarIndicadorBalancaPelaConexao(); }, 15000);
        atualizarIndicadorBalanca("igual");
        if(typeof somClique === "function") somClique();
        return;
    }
    let d = document.getElementById("displayPeso");
    if(d) d.value = formatarPeso(valorKg);
    logBalanca("lançando automático " + valorKg + "kg");
    balancaLancamentoAutomaticoEmCurso = true;
    try{
        adicionarPeso();
    }finally{
        balancaLancamentoAutomaticoEmCurso = false;
    }
}

// chamada por efetivarLancamentoPeso() sempre que um peso entra na lista,
// venha ele da balança ou do botão "Lançar" -- sem isso, apertar "Lançar"
// antes do automático disparar lançava o mesmo animal duas vezes
function registrarPesoLancadoBalanca(pesoNum){
    let automatico = balancaLancamentoAutomaticoEmCurso;
    balancaUltimoValorCapturado = pesoNum;
    if(balancaTimerEstabilidade){ clearTimeout(balancaTimerEstabilidade); balancaTimerEstabilidade = null; }
    balancaValorReferencia = null;
    if(!balancaSessaoAtiva()) return;
    if(automatico) mostrarAvisoTemporarioBalanca("lancado", 1500);
    else{
        if(balancaTimerAvisoTemporario){ clearTimeout(balancaTimerAvisoTemporario); balancaTimerAvisoTemporario = null; }
        atualizarIndicadorBalancaPelaConexao();
    }
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
// tela hub — os dados já vêm do sync (nada pra buscar na hora), só monta
// o cartão "Resumo do Rebanho" a partir do que já está em cache, toda vez
// que a tela abre (mesmos dois avisos já usados na lista de nascimentos,
// aqui só contados em vez de mostrados um por um).
function abrirTelaVacasMatrizMobile(){
    let vacas = obterVacasMatrizCacheMobile();
    let nascimentos = obterNascimentosCacheMobile();

    let vacasAtivas = vacas.filter(v => v.status === "ativa").length;
    let bezerrosVivos = nascimentos.filter(n => n.status === "vivo").length;
    let prontosApartar = nascimentos.filter(n => avisoApartacaoNascimento(n) !== null).length;
    let vacinaPendente = nascimentos.filter(n => avisoVacinaBrucelose(n) !== null).length;

    function set(id, valor){
        let el = document.getElementById(id);
        if(el) el.innerText = String(valor);
    }
    set("vacasResumoAtivas", vacasAtivas);
    set("vacasResumoBezerros", bezerrosVivos);
    set("vacasResumoApartar", prontosApartar);
    set("vacasResumoVacina", vacinaPendente);
}

// "01", "1" e " 1 " são o mesmo brinco pro vaqueiro -- usado pra checagem
// de duplicidade tanto aqui (aviso imediato) quanto no servidor (bloqueio
// de verdade), mesma regra dos dois lados.
function normalizarNumeroAnimal(numero){
    let n = String(numero).trim();
    return /^\d+$/.test(n) ? String(parseInt(n, 10)) : n.toLowerCase();
}

// Idade em meses completos a partir de uma data no formato do sistema
// ("dd/mm/yyyy" ou "dd/mm/yyyy, hh:mm:ss"). null se a data não existir.
function calcularIdadeEmMeses(dataStr){
    let iso = extrairDataISO(dataStr);
    if(!iso) return null;
    let [ano, mes, dia] = iso.split("-").map(Number);
    let nascimento = new Date(ano, mes - 1, dia);
    let agora = new Date();
    let meses = (agora.getFullYear() - nascimento.getFullYear()) * 12 + (agora.getMonth() - nascimento.getMonth());
    if(agora.getDate() < nascimento.getDate()) meses--;
    return meses < 0 ? 0 : meses;
}

// Texto legível de idade pra vaca matriz (anos/meses), pro operador ver
// de cara se o animal já está muito velho.
function formatarIdadeAnimal(dataStr){
    let totalMeses = calcularIdadeEmMeses(dataStr);
    if(totalMeses === null) return "—";
    let anos = Math.floor(totalMeses / 12);
    let meses = totalMeses % 12;
    if(anos === 0) return meses + (meses === 1 ? " mês" : " meses");
    if(meses === 0) return anos + (anos === 1 ? " ano" : " anos");
    return anos + "a " + meses + "m";
}

// Bezerro(a) de 8 a 12 meses ainda vivo = pronto pra apartar; passou de 12
// meses sem apartar = atrasado. Some sozinho assim que o status deixa de
// ser "vivo" (o próprio fluxo de Apartação/Morte já faz isso).
function avisoApartacaoNascimento(n){
    if(!n || n.status !== "vivo") return null;
    let meses = calcularIdadeEmMeses(n.dataNascimento);
    if(meses === null || meses < 8) return null;
    if(meses < 12) return { texto: "🟡 Pronto p/ apartar", cor: "#b8860b" };
    return { texto: "🔴 Atrasado p/ apartar", cor: "#d03b3b" };
}

// Bezerra (fêmea) a partir de 3 meses precisa da vacina contra brucelose.
// Só some quando o operador confirma a vacinação (vacinadaBrucelose) --
// diferente do aviso de apartação, não é calculado, é uma ação explícita.
function avisoVacinaBrucelose(n){
    if(!n || n.status === "morto" || n.sexo !== "femea" || n.vacinadaBrucelose) return null;
    let meses = calcularIdadeEmMeses(n.dataNascimento);
    if(meses === null || meses < 3) return null;
    return { texto: "💉 Vacina brucelose pendente", cor: "#8e24aa" };
}

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
    document.getElementById("nascMobDataInput").value = new Date().toISOString().slice(0, 10);
    let erroEl = document.getElementById("nascMobErro");
    if(erroEl){ erroEl.style.display = "none"; erroEl.innerText = ""; }
}

function confirmarNovoNascimentoMobile(){
    let erroEl = document.getElementById("nascMobErro");
    function mostrarErro(msg){ if(erroEl){ erroEl.innerText = msg; erroEl.style.display = "block"; } }

    let vacaMaeNumero = document.getElementById("nascMobVacaMaeInput").value;
    let numeroBezerro = document.getElementById("nascMobNumeroBezerroInput").value.trim();
    let dataISO = document.getElementById("nascMobDataInput").value;
    if(!vacaMaeNumero){ mostrarErro("Selecione a vaca mãe."); return; }
    if(!numeroBezerro){ mostrarErro("Informe o número do bezerro."); return; }
    if(!dataISO){ mostrarErro("Informe a data de nascimento."); return; }

    let pesoTexto = document.getElementById("nascMobPesoInput").value.trim();
    let pesoNum = pesoTexto ? parseFloat(pesoTexto.replace(",", ".")) : null;

    let lista = JSON.parse(localStorage.getItem("nascimentos") || "[]");
    if(lista.some(n => normalizarNumeroAnimal(n.numeroBezerro) === normalizarNumeroAnimal(numeroBezerro))){ mostrarErro(`Já existe um nascimento com o número de bezerro "${numeroBezerro}".`); return; }
    lista.push({
        id: crypto.randomUUID(),
        numeroBezerro,
        vacaMaeNumero,
        sexo: document.getElementById("nascMobSexoInput").value || null,
        pesoNascimento: Number.isFinite(pesoNum) ? pesoNum : null,
        dataNascimento: formatarDataBR(dataISO),
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
        vivos.map(n => {
            let aviso = avisoApartacaoNascimento(n);
            let prefixo = aviso ? aviso.texto.slice(0, 2) + " " : "";
            return `<option value="${n.id}">${prefixo}${n.numeroBezerro} (mãe ${n.vacaMaeNumero})</option>`;
        }).join("");
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

function abrirTelaVacinaMobile(){
    let select = document.getElementById("vacinaMobBezerraInput");
    let pendentes = obterNascimentosCacheMobile().filter(n => avisoVacinaBrucelose(n));
    select.innerHTML = `<option value="">Selecione a bezerra</option>` +
        pendentes.map(n => `<option value="${n.id}">${n.numeroBezerro} (mãe ${n.vacaMaeNumero})</option>`).join("");
    let erroEl = document.getElementById("vacinaMobErro");
    if(erroEl){ erroEl.style.display = "none"; erroEl.innerText = ""; }
}

function confirmarVacinaMobile(){
    let erroEl = document.getElementById("vacinaMobErro");
    function mostrarErro(msg){ if(erroEl){ erroEl.innerText = msg; erroEl.style.display = "block"; } }

    let nascimentoId = document.getElementById("vacinaMobBezerraInput").value;
    if(!nascimentoId){ mostrarErro("Selecione a bezerra."); return; }

    let lista = JSON.parse(localStorage.getItem("nascimentos") || "[]");
    let nascimento = lista.find(n => n.id === nascimentoId);
    if(!nascimento){ mostrarErro("Bezerra não encontrada — sincronize e tente de novo."); return; }

    nascimento.vacinadaBrucelose = true;
    nascimento.dataVacinacaoBrucelose = new Date().toLocaleString("pt-BR");
    nascimento.sincronizado = false;
    localStorage.setItem("nascimentos", JSON.stringify(lista));

    alert("Vacinação registrada!");
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

// ícones modernos pros botões de editar/excluir das listas de Vacas
// Matriz -- reaproveitados nos dois templates abaixo, no lugar dos
// emojis ✏️/🗑 que estavam lá antes
const ICONE_LAPIS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"></path></svg>';
const ICONE_LIXEIRA_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';

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
    let podeEditarExcluir = obterPapelLogado() === "admin" || (obterPermVacasMatriz() && obterPermEditarNascimentos());
    container.innerHTML = vacas.map(v => {
        let filhos = nascimentos.filter(n => n.vacaMaeNumero === v.numero).length;
        let statusTxt = v.status === "ativa" ? "✅ Ativa" : v.status === "morta" ? "⚰️ Morta" : "➖ Descartada";
        let idade = formatarIdadeAnimal(v.dataNascimento);
        let botoes = podeEditarExcluir ? `
                <button class="btnExcluirItem" onclick='abrirTelaEditarVacaMobile(${jsonAtributo(v.id)})'>${ICONE_LAPIS_SVG}</button>
                <button class="btnExcluirItem" onclick='excluirVacaMobile(${jsonAtributo(v.id)}, ${jsonAtributo(v.numero)})'>${ICONE_LIXEIRA_SVG}</button>
        ` : "";
        return `
            <div class="itemPesagem">
                <span><strong>${escaparHtmlPesagem(v.numero)}</strong>${v.apelido ? " — " + escaparHtmlPesagem(v.apelido) : ""}<br>${idade !== "—" ? idade + " · " : ""}${escaparHtmlPesagem(v.pastoNome || "Sem pasto")} · ${filhos} filho(s)</span>
                <span class="itemPesagemDireita">${statusTxt}${botoes}</span>
            </div>
        `;
    }).join("");
}

let editandoVacaMobileId = null;

function abrirTelaEditarVacaMobile(vacaId){
    let vaca = obterVacasMatrizCacheMobile().find(v => v.id === vacaId);
    if(!vaca) return;
    editandoVacaMobileId = vacaId;
    trocarTela("telaEditarVacaMobile");

    document.getElementById("editVacaMobNumeroInput").value = vaca.numero || "";
    document.getElementById("editVacaMobApelidoInput").value = vaca.apelido || "";
    document.getElementById("editVacaMobRacaInput").value = vaca.raca || "";
    document.getElementById("editVacaMobDataNascimentoInput").value = extrairDataISO(vaca.dataNascimento) || "";
    preencherSelectPastoMobile(document.getElementById("editVacaMobPastoInput"));
    document.getElementById("editVacaMobPastoInput").value = vaca.pastoNome || "";

    let erroEl = document.getElementById("editVacaMobErro");
    if(erroEl){ erroEl.style.display = "none"; erroEl.innerText = ""; }
}

async function salvarEdicaoVacaMobile(){
    let erroEl = document.getElementById("editVacaMobErro");
    function mostrarErro(msg){ if(erroEl){ erroEl.innerText = msg; erroEl.style.display = "block"; } }
    if(!editandoVacaMobileId){ mostrarErro("Nenhuma vaca selecionada."); return; }

    let token = obterToken();
    if(!token){ mostrarErro("Sua sessão expirou."); return; }

    let numero = document.getElementById("editVacaMobNumeroInput").value.trim();
    if(!numero){ mostrarErro("Informe o número (brinco) da vaca."); return; }

    let dataISO = document.getElementById("editVacaMobDataNascimentoInput").value;
    let corpo = {
        numero,
        apelido: document.getElementById("editVacaMobApelidoInput").value.trim() || null,
        raca: document.getElementById("editVacaMobRacaInput").value.trim() || null,
        dataNascimento: dataISO ? formatarDataBR(dataISO) : null,
        pastoNome: document.getElementById("editVacaMobPastoInput").value || null
    };

    try {
        let resp = await fetch(`${API_URL}/api/vacas-matriz/${editandoVacaMobileId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify(corpo)
        });
        let dados = await resp.json().catch(() => ({}));
        if(!resp.ok){ mostrarErro(dados.erro || `Erro ao salvar (HTTP ${resp.status}).`); return; }

        let lista = JSON.parse(localStorage.getItem("vacasMatriz") || "[]");
        let idx = lista.findIndex(v => v.id === editandoVacaMobileId);
        if(idx >= 0) lista[idx] = { ...lista[idx], ...dados, sincronizado: true };
        localStorage.setItem("vacasMatriz", JSON.stringify(lista));

        alert("Vaca atualizada!");
        editandoVacaMobileId = null;
        trocarTela("telaVacasListaMobile");
        mostrarVacasListaMobile();
    } catch(e) {
        mostrarErro("Erro de conexão — verifique sua internet e tente de novo.");
    }
}

function excluirVacaMobile(vacaId, numero){
    if(!confirm(`Excluir a vaca "${numero}" permanentemente? Os nascimentos já registrados dela continuam existindo. Essa ação não pode ser desfeita.`)) return;
    let token = obterToken();
    if(!token){ alert("Sua sessão expirou."); return; }
    fetch(`${API_URL}/api/vacas-matriz/${vacaId}`, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + token }
    }).then(async resp => {
        let dados = await resp.json().catch(() => ({}));
        if(!resp.ok){ alert(dados.erro || `Erro ao excluir (HTTP ${resp.status}).`); return; }
        let lista = JSON.parse(localStorage.getItem("vacasMatriz") || "[]");
        lista = lista.filter(v => v.id !== vacaId);
        localStorage.setItem("vacasMatriz", JSON.stringify(lista));
        mostrarVacasListaMobile();
    }).catch(() => {
        alert("Erro de conexão — verifique sua internet e tente de novo.");
    });
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
    let podeEditarExcluir = obterPapelLogado() === "admin" || (obterPermVacasMatriz() && obterPermEditarNascimentos());
    container.innerHTML = nascimentos.map(n => {
        let statusTxt = n.status === "vivo" ? "🐮 Vivo" : n.status === "apartado" ? "✅ Apartado" : "⚰️ Morto";
        let avisos = [avisoApartacaoNascimento(n), avisoVacinaBrucelose(n)].filter(Boolean);
        let avisosHtml = avisos.map(a => `<br><span style="color:${a.cor}">${a.texto}</span>`).join("");
        let botoes = podeEditarExcluir ? `
                <button class="btnExcluirItem" onclick='abrirTelaEditarNascimentoMobile(${jsonAtributo(n.id)})'>${ICONE_LAPIS_SVG}</button>
                <button class="btnExcluirItem" onclick='excluirNascimentoMobile(${jsonAtributo(n.id)}, ${jsonAtributo(n.numeroBezerro)})'>${ICONE_LIXEIRA_SVG}</button>
        ` : "";
        return `
            <div class="itemPesagem">
                <span><strong>${n.numeroBezerro}</strong> (mãe ${n.vacaMaeNumero})<br>${n.dataNascimento ? n.dataNascimento.split(",")[0] : "—"} · ${formatarIdadeAnimal(n.dataNascimento)}${avisosHtml}</span>
                <span class="itemPesagemDireita">${statusTxt}${botoes}</span>
            </div>
        `;
    }).join("");
}

let editandoNascimentoMobileId = null;

function abrirTelaEditarNascimentoMobile(nascimentoId){
    let nascimento = obterNascimentosCacheMobile().find(n => n.id === nascimentoId);
    if(!nascimento) return;
    editandoNascimentoMobileId = nascimentoId;
    trocarTela("telaEditarNascimentoMobile");

    let selectVaca = document.getElementById("editNascMobVacaMaeInput");
    let vacasAtivas = obterVacasMatrizCacheMobile().filter(v => v.status === "ativa");
    let optionsHtml = vacasAtivas.map(v => `<option value="${v.numero.replace(/"/g, "&quot;")}">${v.numero}${v.apelido ? " — " + v.apelido : ""}</option>`).join("");
    if(nascimento.vacaMaeNumero && !vacasAtivas.some(v => v.numero === nascimento.vacaMaeNumero)){
        optionsHtml += `<option value="${nascimento.vacaMaeNumero.replace(/"/g, "&quot;")}">${nascimento.vacaMaeNumero} (não encontrada/inativa)</option>`;
    }
    selectVaca.innerHTML = `<option value="">Selecione a vaca mãe</option>` + optionsHtml;
    selectVaca.value = nascimento.vacaMaeNumero || "";

    document.getElementById("editNascMobNumeroBezerroInput").value = nascimento.numeroBezerro || "";
    document.getElementById("editNascMobSexoInput").value = nascimento.sexo || "";
    document.getElementById("editNascMobPesoInput").value = nascimento.pesoNascimento != null ? String(nascimento.pesoNascimento).replace(".", ",") : "";
    document.getElementById("editNascMobDataInput").value = extrairDataISO(nascimento.dataNascimento) || "";
    preencherSelectPastoMobile(document.getElementById("editNascMobPastoInput"));
    document.getElementById("editNascMobPastoInput").value = nascimento.pastoNome || "";

    let erroEl = document.getElementById("editNascMobErro");
    if(erroEl){ erroEl.style.display = "none"; erroEl.innerText = ""; }
}

async function salvarEdicaoNascimentoMobile(){
    let erroEl = document.getElementById("editNascMobErro");
    function mostrarErro(msg){ if(erroEl){ erroEl.innerText = msg; erroEl.style.display = "block"; } }
    if(!editandoNascimentoMobileId){ mostrarErro("Nenhum nascimento selecionado."); return; }

    let token = obterToken();
    if(!token){ mostrarErro("Sua sessão expirou."); return; }

    let vacaMaeNumero = document.getElementById("editNascMobVacaMaeInput").value;
    let numeroBezerro = document.getElementById("editNascMobNumeroBezerroInput").value.trim();
    let dataISO = document.getElementById("editNascMobDataInput").value;
    if(!vacaMaeNumero){ mostrarErro("Selecione a vaca mãe."); return; }
    if(!numeroBezerro){ mostrarErro("Informe o número do bezerro."); return; }
    if(!dataISO){ mostrarErro("Informe a data de nascimento."); return; }

    let pesoTexto = document.getElementById("editNascMobPesoInput").value.trim();
    let pesoNum = pesoTexto ? parseFloat(pesoTexto.replace(",", ".")) : null;

    let corpo = {
        numeroBezerro,
        vacaMaeNumero,
        sexo: document.getElementById("editNascMobSexoInput").value || null,
        pesoNascimento: Number.isFinite(pesoNum) ? pesoNum : null,
        dataNascimento: formatarDataBR(dataISO),
        pastoNome: document.getElementById("editNascMobPastoInput").value || null
    };

    try {
        let resp = await fetch(`${API_URL}/api/nascimentos/${editandoNascimentoMobileId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify(corpo)
        });
        let dados = await resp.json().catch(() => ({}));
        if(!resp.ok){ mostrarErro(dados.erro || `Erro ao salvar (HTTP ${resp.status}).`); return; }

        let lista = JSON.parse(localStorage.getItem("nascimentos") || "[]");
        let idx = lista.findIndex(n => n.id === editandoNascimentoMobileId);
        if(idx >= 0) lista[idx] = { ...lista[idx], ...dados, sincronizado: true };
        localStorage.setItem("nascimentos", JSON.stringify(lista));

        alert("Nascimento atualizado!");
        editandoNascimentoMobileId = null;
        trocarTela("telaNascimentosListaMobile");
        mostrarNascimentosListaMobile();
    } catch(e) {
        mostrarErro("Erro de conexão — verifique sua internet e tente de novo.");
    }
}

function excluirNascimentoMobile(nascimentoId, numeroBezerro){
    if(!confirm(`Excluir o registro de nascimento do bezerro "${numeroBezerro}"? Essa ação não pode ser desfeita.`)) return;
    let token = obterToken();
    if(!token){ alert("Sua sessão expirou."); return; }
    fetch(`${API_URL}/api/nascimentos/${nascimentoId}`, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + token }
    }).then(async resp => {
        let dados = await resp.json().catch(() => ({}));
        if(!resp.ok){ alert(dados.erro || `Erro ao excluir (HTTP ${resp.status}).`); return; }
        let lista = JSON.parse(localStorage.getItem("nascimentos") || "[]");
        lista = lista.filter(n => n.id !== nascimentoId);
        localStorage.setItem("nascimentos", JSON.stringify(lista));
        mostrarNascimentosListaMobile();
    }).catch(() => {
        alert("Erro de conexão — verifique sua internet e tente de novo.");
    });
}

// chamada depois de cada sincronização — atualiza a lista se a tela de
// consulta estiver aberta na hora, sem o usuário precisar sair e voltar.
function mostrarVacasMatrizMobile(){
    let telaVacas = document.getElementById("telaVacasListaMobile");
    if(telaVacas && telaVacas.classList.contains("ativa")) mostrarVacasListaMobile();
    let telaNasc = document.getElementById("telaNascimentosListaMobile");
    if(telaNasc && telaNasc.classList.contains("ativa")) mostrarNascimentosListaMobile();
}
