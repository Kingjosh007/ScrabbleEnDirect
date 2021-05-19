var scraper = require("table-scraper");
const { printTable } = require("console-table-printer");
const chalk = require('chalk');


var fichierJoueurs = require("./joueursParNation.json");
var parametresTournoi = require("./parametresTournoi.json")



var lienTournoi = parametresTournoi.lienTournoi;
var numPartie = parametresTournoi.numeroPartie;
let nomTournoi = parametresTournoi.nomTournoi;


function linkBuilder(np, nc) {
  return (
    lienTournoi + "&numero=" + np + "&coup=" + nc + "&action=scores&tri=table"
  );
}

function codePaysJoueur(nom)
{
    if(nom == undefined)
        return "";
    let firstApproach = fichierJoueurs.filter(p => p.joueurs.includes(nom))[0];
    if(firstApproach == undefined)
    {
        let firstName = nom.split(" ")[0];
        secondApproach = fichierJoueurs.filter(p => p.joueurs.some(el => el.startsWith(firstName + " ")))[0];
        return secondApproach != undefined ? secondApproach.codeNation : "";
    }
    else
        return firstApproach.codeNation;
}


function nomPaysJoueur(nom)
{
    if(nom == undefined)
        return "";
    let firstApproach = fichierJoueurs.filter(p => p.joueurs.includes(nom))[0];
    if(firstApproach == undefined)
    {
        let firstName = nom.split(" ")[0];
        secondApproach = fichierJoueurs.filter(p => p.joueurs.some(el => el.startsWith(firstName + " ")))[0];
        return secondApproach != undefined ? secondApproach.nomNation : "";
    }
    else
        return firstApproach.nomNation;
}

async function classementPartie(np, pourCumul = false) {
  let canProcess = true;
  let coupActuel = 1;

  if (pourCumul == false)
    console.log(
      "\n\n\n     " +
        nomTournoi +
        " - PARTIE NUMERO " +
        np +
        " - CLASSEMENT PROVISOIRE  \n\n"
    );

  var playersNegatifsInfos = [];

  while (canProcess) {
    let link = linkBuilder(np, coupActuel);
    //   console.log(coupActuel);
    let data = await scraper.get(link);
    let classementArr = data[0].slice(1);

    // console.log(classementArr[0]);

    for (let c of classementArr) {
      let playerName = c["1"];
      let playerSerie = c["3"];
      let playerNeg = c["2"] == "Top" ? 0 : Number(c["2"]);

      let playerObj = {
        Nom: playerName,
        "Pays": codePaysJoueur(playerName),
        "Série": playerSerie,
        Négatif: playerNeg,
      };
      let playerBilan = playersNegatifsInfos.find((p) => p.Nom == playerName);
      if (playerBilan == undefined) playersNegatifsInfos.push(playerObj);
      else {
        let newBilan = playerBilan;
        newBilan["Négatif"] = newBilan["Négatif"] + playerObj["Négatif"];

        playersNegatifsInfos = playersNegatifsInfos.filter(
          (p) => p.Nom != playerBilan.Nom
        );
        playersNegatifsInfos.push(newBilan);
      }
    }
    coupActuel++;
    canProcess = classementArr.length > 3;
  }

  playersNegatifsInfos = playersNegatifsInfos.sort(
    (a, b) => b["Négatif"] - a["Négatif"]
  );
  playersNegatifsInfos = playersNegatifsInfos.map((el) => {
    let newEl = el;
    if (newEl["Négatif"] == 0) newEl["Négatif"] = "Top";
    return newEl;
  });

  return playersNegatifsInfos;
}

async function bilanDuCoupParTable(np, nc) {
  let canProcess = true;
  let coupActuel = nc;

  console.log(
    "\n\n\n      " +
      nomTournoi +
      " - PARTIE NUMERO " +
      np +
      " - COUP NUMERO " +
      nc +
      "\n\n"
  );

  var playersNegatifsInfos = [];

  let link = linkBuilder(np, coupActuel);
  //   console.log(coupActuel);
  let data = await scraper.get(link);
  let classementArr = data[0].slice(1);

  for (let c of classementArr) {
    let playerName = c["1"];
    let playerSerie = c["3"];
    let playerNeg = c["2"] == "Top" ? 0 : Number(c["2"]);
    let numTable = Number(
      c[Object.keys(c).filter((el) => el.startsWith("Détail"))[0]]
    );

    let playerObj = {
      Table: numTable,
      Nom: playerName,
      Pays: codePaysJoueur(playerName),
      "Série": playerSerie,
      Négatif: playerNeg,
    };
    let playerBilan = playersNegatifsInfos.find((p) => p.Nom == playerName);
    if (playerBilan == undefined) playersNegatifsInfos.push(playerObj);
    else {
      let newBilan = playerBilan;
      newBilan["Négatif"] = newBilan["Négatif"] + playerObj["Négatif"];

      playersNegatifsInfos = playersNegatifsInfos.filter(
        (p) => p.Nom != playerBilan.Nom
      );
      playersNegatifsInfos.push(newBilan);
    }
  }

  playersNegatifsInfos = playersNegatifsInfos.sort(
    (a, b) => a["Table"] - b["Table"]
  );
  playersNegatifsInfos = playersNegatifsInfos.map((el) => {
    let newEl = el;
    if (newEl["Négatif"] == 0) newEl["Négatif"] = "Top";
    return newEl;
  });

  return playersNegatifsInfos;
}

async function classementAuCumul(nbParties) {
  let cumulArr = [];

  console.log(
    "\n\n\n        " +
      nomTournoi +
      " - CUMUL PROVISOIRE APRES " +
      nbParties +
      " MANCHES \n\n"
  );

  for (let i = 1; i <= nbParties; i++) {
    let clPartie = await classementPartie(i, true);
    clPartie = clPartie.map((el) => {
      let newEl = el;
      if (newEl["Négatif"] == "Top") newEl["Négatif"] = 0;
      return newEl;
    });
    for (let pl of clPartie) {
      if (cumulArr.filter((el) => el.Nom == pl.Nom).length > 0) {
        let plCopy = cumulArr.find((el) => el.Nom == pl.Nom);
        plCopy["Négatif"] += pl["Négatif"];
        let indPartie = 0;
        for (let j = 1; j < 30; j++) {
          if (plCopy.hasOwnProperty("P" + j)) {
            indPartie = j + 1;
          }
        }
        plCopy["P" + indPartie] = pl["Négatif"];
        cumulArr = cumulArr.filter((el) => el.Nom != pl.Nom);
        cumulArr.push(plCopy);
      } else {
        pl["P1"] = pl["Négatif"];
        cumulArr.push(pl);
      }
    }
  }

  cumulArr = cumulArr.sort((a, b) => b["Négatif"] - a["Négatif"]);
  cumulArr = cumulArr.filter(
    (pl) =>
      pl.hasOwnProperty("P1") &&
      pl.hasOwnProperty("P2") &&
      Number(pl.P1) &&
      Number(pl.P2)
  );
  cumulArr = cumulArr.map((el) => {
    let newEl = el;
    if (el["Négatif"] == 0) newEl["Cumul"] = "Top";
    else newEl["Cumul"] = el["Négatif"];

    delete newEl["Négatif"];
    return newEl;
  });

  return cumulArr;
}

(async function launch() {

  let classement = await classementPartie(numPartie);
  // let classement = await bilanDuCoupParTable(numPartie, 23);
  // let classement = await classementAuCumul(numPartie);

  console.table(classement);

})();
