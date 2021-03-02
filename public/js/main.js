var softcap = 800000;
var hardcap = 2000000;


var boughtDank = 0;

const saleHash = hashToByteArray("043D730801A8FDCD17F1E540C08282E91A387FA6236D43A39A10EAA01622BC4D");
// const saleHash = hashToByteArray("11AF1789D352FB8B9FCB1B787975C5BD93583C253CDB853C63F84A3053D10493");  // testnet sale

// const apiUrl = 'http://testnet.phantasma.io:7078';
const apiUrl = 'https://seed.ghostdevs.com:7078'

// const apiUrl = 'http://localhost:7078'; 

function hashToByteArray(hexBytes) {
    const res = [];
    for (let i = 0; i < hexBytes.length; i += 2) {
        const hexdig = hexBytes.substr(i, 2);
        if (hexdig == "") {
            res.unshift(0);
        } else res.unshift(parseInt(hexdig, 16));
    }

    res.unshift(hexBytes.length / 2)
    return res;
}

function login() {

    link = new PhantasmaLink("MemeUnity Sales");

    link.login(function (success) {

        if (success) {

            linkWallet = link.wallet
            linkAddress = link.account.address
            linkName = link.account.name
            linkBalances = link.account.balances
            linkBalSOUL = 0
            linkBalKCAL = 0

            linkBalancesSOUL = linkBalances.filter(function (el) {
                return el.symbol == 'SOUL';
            });
            if (linkBalancesSOUL.length > 0) {
                linkBalSOUL = linkBalancesSOUL[0].value / (Math.pow(10, linkBalancesSOUL[0].decimals));
            }
            linkBalancesKCAL = linkBalances.filter(function (el) {
                return el.symbol == 'KCAL';
            });
            if (linkBalancesKCAL.length > 0) {
                linkBalKCAL = linkBalancesKCAL[0].value / (Math.pow(10, linkBalancesKCAL[0].decimals));
            }

            if (parseFloat(linkBalKCAL) < 0.1 && parseFloat(linkBalKCAL) > 0) {
                bootbox.alert("Not enough KCAL available. You need at least 0.1 KCAL to perform a transaction!");
                return;
            }

            contentBootbox = 'Connected wallet: ' + linkName + ' • ' + formatAddressShort(linkAddress)
                + '<br>SOUL balance: ' + parseFloat(linkBalSOUL).toFixed(0) + ' SOUL'
                + '<span id="alreadyBought" style="display:none">You already bought: <span id="boughtDank"></span> DANK</span>'
                + '<br><br>How much SOUL do you want to contribute to the sale?'
                + '<br><br><input type="text" class="form-control" name="amountsale" id="amountsale"><br>'
                + "Note: you have to be whitelisted with your address or your transaction will be refunded."

            dialog = bootbox.confirm({
                title: "Sale participation confirmation",
                message: contentBootbox,
                buttons: {
                    cancel: {
                        label: '<i class="fa fa-times"></i> Cancel',
                        className: 'btn btn-default'
                    },
                    confirm: {
                        label: '<i class="fa fa-check"></i> Confirm transaction',
                        className: 'btn btn-primary buy-confirm'
                    }
                },
                callback: function (result) {

                    if (result) {

                        results = {};
                        results.fieldname1 = dialog[0].querySelector("[name=amountsale]").value;
                        sendAmount = results.fieldname1
                        console.log("boughtDank", boughtDank);
                        var boughtAmount = boughtDank/4;
                        var totalAmount = parseFloat(sendAmount) + boughtAmount
                        console.log("Total buy will be "+ totalAmount);
                        if (totalAmount < 6250/4) {
                            bootbox.alert('Amount too low!<br>You need to participate with at least 1,563 SOUL');
                            return;
                        }
                        if (totalAmount > 312500/4) {
                            bootbox.alert('Amount too high!<br>You can participate only up to 78,125 SOUL');
                            return;
                        }
                        if (parseFloat(sendAmount) < 100) {
                            bootbox.alert('Amount too low!<br>You need to buy at least 100 SOUL more');
                            return;
                        }

                        send(sendAmount)

                    } else {

                    }

                }
            })

            var purScript = new ScriptBuilder().callContract('sale', 'GetPurchasedAmount', [saleHash, linkAddress]).endScript();
            $.getJSON(apiUrl + '/api/invokeRawScript?chainInput=main&scriptData=' + purScript,
                function (data) {
                    var dec = new Decoder(data.result);
                    console.log('type', dec.readByte());
                    boughtDank = dec.readBigInt() / 10 ** 18;
                    console.log("purchased amount", boughtDank);
                    $("#alreadyBought").css("display", "block")
                    $("#boughtDank").html(boughtDank);
                });


        }

    })

}

function formatAddressShort(address) {

    if (!address) return ''
    const lastFiveChar = address.substr(address.length - 5)
    const firstFiveChar = address.substr(0, 5)
    const addressFormated = firstFiveChar + '...' + lastFiveChar
    return addressFormated

}

function numberWithCommas(x, decimals) {
    decimals = typeof decimals == "undefined" ? 2 : decimals;
    var parts = x.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (decimals == 0)
        return parts[0];
    if (parts.length > 1 && parts[1].length > decimals)
        return parts[0] + "." + parts[1].substr(0, decimals);
    return parts.join(".")

}

function send(sendAmount) {

    const assetSymbol = 'SOUL'
    const gasPrice = 100000;
    const minGasLimit = 2100;

    sb = new ScriptBuilder();

    // paramArrayTransfer = [linkAddress, contractAddress, assetSymbol, Math.floor(sendAmount * 10 ** 8)];

    script = sb.callContract('gas', 'AllowGas', [linkAddress, sb.nullAddress(), gasPrice, minGasLimit])
        .callContract("sale", "Purchase", [linkAddress, saleHash, assetSymbol, Math.floor(sendAmount * 10 ** 8)])
        .callContract('gas', 'SpendGas', [linkAddress])
        .endScript();

    link.signTx(script, null, function (result) {
        console.log('result signTx', result)

        if (result.error || result.hash.error) {
            var error = result.error ? result.error : result.hash.error;
            console.log(error)
            bootbox.alert('Error: ' + error);
        }
        else if (result.success) {
            var hash = result.hash;

            setTimeout(function () {
                $.getJSON(apiUrl + '/api/getTransaction?hashText=' + hash,
                    function (res) {
                        console.log(res)
                        if (
                            res &&
                            res.error &&
                            res.error !== 'pending'
                        ) {
                            console.log(res.error)
                            bootbox.alert('error: ' + res.error);
                        } else {
                            console.log('tx successful: ', (res.hash).substring(0, 10))
                            bootbox.alert('Purchase success - tx hash: ' + (res.hash).substring(0, 10));
                        }
                    })
            }, 2000);
        }

    })
}


var reached = 0;
var sb = new ScriptBuilder();

var script = sb.callContract('sale', 'GetSoldAmount', [saleHash]).endScript();
$.getJSON(apiUrl + '/api/invokeRawScript?chainInput=main&scriptData=' + script,
	function (data) {
			// debugger;
		console.log("invokeRaw", data);
		var dec = new Decoder(data.result);
		console.log('type', dec.readByte());
		reached = dec.readBigInt() / 10 ** 18;
		console.log('got reached', reached);

		// calculate progress
		var progress = (100 * reached) / hardcap;
		if (progress > 100)
			progress = 100;
		$(".progress").css("width", progress.toFixed(3) + "%");
        $("#reached").html(numberWithCommas(reached, 0));
	});

// calculate progress
$(".progress").css("width", (100 * reached) / hardcap + "%");

// set softcap pos
$("#softcap-mark").css("left", (100 * softcap) / hardcap + "%");
$("#hardcap").html(numberWithCommas(hardcap, 0));

// email form functionality
$(document).ready(() =>
  $('.emailbutton').click(() => {
    const validator = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/
    const email = $('#footeremail').val()
    const name = $('#footername').val()
    const emailIsValid = validator.test(email)
    const isString = s => typeof s === 'string'
    const isUnderMaxLength = (max, s) => s.length < max
    const noLineBreak = s => !s.includes('\n')
    const noBars = s => !s.includes('|')
    const nameValidator = name => isString(name) && isUnderMaxLength(60, name) && noLineBreak(name) && noBars(name)
    const nameIsValid = nameValidator(name)
    // const validationTest = {}
    // validationTest["a@a"] = nameIsValid("a@a")
    // validationTest["a@a.a"] = nameIsValid("a@a.a")
    // validationTest["asdasdasd@|"] = nameIsValid("asdasdasd@|")
    // validationTest["asdasdasd@awa.co\n"] = nameIsValid("asdasdasd@awa.co\n")
    // alert(JSON.stringify(validationTest))
    if (!email.includes('|') && emailIsValid && nameIsValid) {
      const opts = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({name: btoa(name), email: btoa(email)})
      }
      fetch('https://hustlecraft.io/api', opts)
        .then(res => res.text())
        .then(r => {
          $('.invalid').hide()
          $('.success').show()
          $('.emailbutton').toggle('disabled')
        })
        .catch(e => {
          $('.success').hide()
          $('.invalid').text('Request failed. Is it your internet or is it our server?')
          $('.invalid').show()
          console.error(e)
        })
    } else {
      $('.success').hide()
      $('.invalid').show()
    }

  }))
