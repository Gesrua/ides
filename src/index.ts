import { getImageSet, ImageSet, intersection } from "./image";
import * as inquirer from "inquirer";
import chalk = require("chalk");
import { removeSync } from "fs-extra";
import { exec } from "child_process";
const log = console.log;

(async () => {
  log(chalk.blue.bold("Step 1:"), "Input image directories");
  log(chalk.yellow("it will generate data.json in every directory"));
  log(chalk.yellow("it will not scan recursively"));
  log(chalk.yellow("directory scans will be performed together"));

  const dirs = [];

  const quesImageSet = {
    type: "input",
    name: "p",
    message: "Image directory",
  };
  const quesContinue = {
    type: "confirm",
    name: "continue",
    message: "Continue",
  };
  while (1) {
    dirs.push((await inquirer.prompt([quesImageSet])).p);
    if (!(await inquirer.prompt([quesContinue])).continue) break;
  }

  const sets: ImageSet[] = [];
  for (let dir of dirs) sets.push(await getImageSet(dir));

  log(chalk.green.bold("Finish adding all directories"));

  log(chalk.blue.bold("Step 2:"), "check duplicate between different directory");
  for(let i = 0; i < sets.length; i++) {
    for (let j = 0; j < i; j++) {
      const s = intersection(sets[i], sets[j]);
      for(const image of s.images) {
        const paths = image.duplicate_paths.concat(image.path);
        const p1 = exec(`feh '${image.path}'`);
        const preserve = await inquirer.prompt([
          {
            type: 'list',
            name: 'path',
            message: 'Which to preserve',
            choices: image.duplicate_paths.concat(image.path).concat('Preserve All'),
          }
        ])
        p1.kill();
        if (preserve.path != 'Preserve All'){
          paths.filter(s => s != preserve.path).forEach(p => {
              removeSync(p);
              console.log('remove', p);
          });
        }
      }
    }
  }
})();
