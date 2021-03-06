var scraper = require("table-scraper");
const { printTable } = require("console-table-printer");
const chalk = require('chalk');
const clipboardy = require('clipboardy');


var fichierJoueurs = require("./joueursParNation.json");
var parametresTournoi = require("./parametresTournoi.json")



const lienTournoi = parametresTournoi.lienTournoi;
const numPartie = parametresTournoi.numeroPartie;
const nomTournoi = parametresTournoi.nomTournoi;
const intrus = parametresTournoi.intrus;


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
      // console.log(c);
      let playerName = c["1"];
      let playerSerie = c["3"];
      let playerNeg = c["2"] == "Top" ? 0 : Number(c["2"]);
      

      let playerObj = {
        Nom: playerName,
        "Pays": codePaysJoueur(playerName),
        "S??rie": playerSerie,
        N??gatif: playerNeg,
      };
      let playerBilan = playersNegatifsInfos.find((p) => p.Nom == playerName);
      if (playerBilan == undefined) playersNegatifsInfos.push(playerObj);
      else {
        let newBilan = playerBilan;
        newBilan["N??gatif"] = newBilan["N??gatif"] + playerObj["N??gatif"];

        playersNegatifsInfos = playersNegatifsInfos.filter(
          (p) => p.Nom != playerBilan.Nom
        );
        playersNegatifsInfos.push(newBilan);
      }
    }
    coupActuel++;
    canProcess = classementArr.length > 3;
  }

  playersNegatifsInfos = playersNegatifsInfos
    .filter(obj => !intrus.includes(obj.Nom))
    .sort(
    (a, b) => b["N??gatif"] - a["N??gatif"]
  );
  playersNegatifsInfos = playersNegatifsInfos.map((el) => {
    let newEl = el;
    if (newEl["N??gatif"] == 0) newEl["N??gatif"] = "Top";
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
      c[Object.keys(c).filter((el) => el.startsWith("D??tail"))[0]]
    );

    let playerObj = {
      Table: numTable,
      Nom: playerName,
      Pays: codePaysJoueur(playerName),
      "S??rie": playerSerie,
      N??gatif: playerNeg,
    };
    let playerBilan = playersNegatifsInfos.find((p) => p.Nom == playerName);
    if (playerBilan == undefined) playersNegatifsInfos.push(playerObj);
    else {
      let newBilan = playerBilan;
      newBilan["N??gatif"] = newBilan["N??gatif"] + playerObj["N??gatif"];

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
    if (newEl["N??gatif"] == 0) newEl["N??gatif"] = "Top";
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
      if (newEl["N??gatif"] == "Top") newEl["N??gatif"] = 0;
      return newEl;
    });
    for (let pl of clPartie) {
      if (cumulArr.filter((el) => el.Nom == pl.Nom).length > 0) {
        let plCopy = cumulArr.find((el) => el.Nom == pl.Nom);
        plCopy["N??gatif"] += pl["N??gatif"];
        let indPartie = 0;
        for (let j = 1; j < 30; j++) {
          if (plCopy.hasOwnProperty("P" + j)) {
            indPartie = j + 1;
          }
        }
        plCopy["P" + indPartie] = pl["N??gatif"] == 0 ? "Top": pl["N??gatif"];
        cumulArr = cumulArr.filter((el) => el.Nom != pl.Nom);
        cumulArr.push(plCopy);
      } else {
        pl["P1"] = pl["N??gatif"] == 0 ? "Top": pl["N??gatif"];
        cumulArr.push(pl);
      }
    }
  }

  let allPs = [];
  for(let k=1; k<=nbParties; k++)
  {
    allPs.push("P"+k);
  }
  cumulArr = cumulArr.sort((a, b) => b["N??gatif"] - a["N??gatif"]);
  cumulArr = cumulArr.filter(
    (pl) => allPs.every(pp => pl.hasOwnProperty(pp) && pl[pp]!=undefined)  
  );
  cumulArr = cumulArr.map((el) => {
    let newEl = el;
    if (el["N??gatif"] == 0) newEl["Cumul"] = "Top";
    else newEl["Cumul"] = el["N??gatif"];

    delete newEl["N??gatif"];
    return newEl;
  });

  return cumulArr;
}

const clString = (rg) => rg==1? "1er": rg+"??me";

function classementParNations(classementGlobal, np) {

  console.log(
    "\n\n\n       " +
      nomTournoi +
      " - CLASSEMENT PROVISOIRE DES NATIONS APRES " +
      np +
      " PARTIES \n\n"
  );

  console.log("       Classement bas?? sur les performances des 5 meilleurs joueurs de chaque nation ayant align?? au moins 5 joueurs sur l'??preuve.")

  console.log("\n       Chaque nom est suivi de son classement global et de son n??gatif entre parenth??ses \n\n");

  let pp = [];
  for(let i=1; i<=np; i++)
      pp.push("P"+i);

  let classementModif = classementGlobal.map((el, i) => {
    let newEl = {
      "Rang": i+1,
      "NomPays": nomPaysJoueur(el["Nom"])
    }
    for(let k in el)
    {
      newEl[k] = el[k];
    }
    return newEl;
  })
  // Juste les pays qui ont au moins 5 joueurs ayant disput?? toutes les parties;
  let paysConcernes = fichierJoueurs.filter(p => {
    let joueursAyantToutJoue = classementModif.filter(cl =>  {
      return cl.Pays == p.codeNation && pp.every(key => cl.hasOwnProperty(key) && cl[key]!=undefined)
    })  
    return joueursAyantToutJoue.length >= 5;
  });

  let codesPays = [...new Set(paysConcernes.map(el => el.codeNation))];

  let classementArr = [];

  for(let pays of codesPays)
  {
    let topFive = classementModif.filter(el => el.Pays == pays)
                                 .sort((a, b) => b["Cumul"] - a["Cumul"])
                                 .slice(0, 5);
    // console.log(topFive);
    
    let clObj = {
      "Pays": nomPaysJoueur(topFive[0].Nom),
      "Premier": topFive[0].Nom.slice(0, 5) + "..." + "(" + clString(topFive[0].Rang) + "/" + topFive[0]["Cumul"] + ")",
      "Deuxi??me": topFive[1].Nom.slice(0, 5) + "..." + "(" + clString(topFive[1].Rang) + "/" + topFive[1]["Cumul"] + ")",
      "Troisi??me": topFive[2].Nom.slice(0, 5) + "..." + "(" + clString(topFive[2].Rang) + "/" + topFive[2]["Cumul"] + ")",
      "Quatri??me": topFive[3].Nom.slice(0, 5) + "..." + "(" + clString(topFive[3].Rang) + "/" + topFive[3]["Cumul"] + ")",
      "Cinqui??me": topFive[4].Nom.slice(0, 5) + "..." + "(" + clString(topFive[4].Rang) + "/" + topFive[4]["Cumul"] + ")",
      "Cumul": topFive.reduce((t, el) => t + el["Cumul"], 0)
    }

    classementArr.push(clObj);
  }
  
  return classementArr.sort((a, b) => b.Cumul - a.Cumul);

  
}

(async function launch() {

  // let classement = await classementPartie(numPartie);
  // let classement = await bilanDuCoupParTable(numPartie, 11);
  let classement = await classementAuCumul(numPartie);
  // let classement = require("./classementTest.json");
  // clipboardy.writeSync(JSON.stringify(classement));
  // classement = classementParNations(classement, numPartie);

  console.table(classement);

})();
