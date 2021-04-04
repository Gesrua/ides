import { hash as getHash } from "imghash";
import BKTree = require("bktree-fast");
import chalk = require('chalk');
import {
  pathExistsSync,
  readdirSync,
  readJSONSync,
  removeSync,
  writeJSONSync,
} from "fs-extra";
import { extname, join, basename } from "path";
import * as inquirer from "inquirer";
import { exec } from "child_process";

const exts = [".jpg", ".jpeg", ".png", ".webp", '.JPG', '.JPEG'];
const quesSame = {
  type: "confirm",
  name: "same",
  message: "Is two images same",
  default: true,
};

export interface Image {
  path: string;
  duplicate_paths?: string[];
  pixiv_id?: string | null;
  hash: string;
}

export function isImage(p) {
  return exts.includes(extname(p));
}

export async function getImage(path, pixiv?: boolean): Promise<Image> {
  let hash;
  try {
    hash = await getHash(path, 16);
  } catch (e) {
    console.log(e);
    console.log(path);
    throw e;
  }
  const img: Image = {
    path,
    hash,
  };
  return img;
}

function mergeImage(a: Image, b: Image): Image {
  let duplicate_paths = [];
  if (a.duplicate_paths)
    duplicate_paths = duplicate_paths.concat(a.duplicate_paths);
  if (b.duplicate_paths)
    duplicate_paths = duplicate_paths.concat(b.duplicate_paths);
  duplicate_paths.push(b.path);

  return {
    path: a.path,
    duplicate_paths: Array.from(new Set(duplicate_paths)),
    hash: a.hash,
  };
}

export interface ImageSet {
  images: Image[];
}

export function deleteDuplicate(imageSet: ImageSet) {
  imageSet.images.forEach(image => {
    if (image.duplicate_paths){
        image.duplicate_paths.forEach(p => {
        console.log(chalk.red('remove'), basename(p));
        removeSync(p);
      })
    }
    image.duplicate_paths = undefined;
  })
}

async function isSamePrompt(a: Image, b: Image):Promise<boolean> {
  const p1 = exec(`feh '${a.path}'`);
  const p2 = exec(`feh '${b.path}'`);
  const same = (await inquirer.prompt([quesSame])).same;
  p1.kill(3);
  p2.kill(3);
  return same;
}

async function _deduplicate1(imageSet: ImageSet) {
  let imgs: Image[] = [];
  let images = imageSet.images;
  let hashTable = {};

  const tree = new BKTree(256);
  
  for (let i = 0; i < images.length; i++) {
    const similars: {found: string, distance: number}[] = [];
    tree.query(images[i].hash, 2, (found, distance) => {
      similars.push({found, distance});
    })
    if (similars.length == 0) {
      tree.add(images[i].hash);
      hashTable[images[i].hash] = imgs.length;
      imgs.push(images[i]);
    } else {
      const similar_img = hashTable[similars[0].found];
      imgs[similar_img] = mergeImage(imgs[similar_img], images[i]);
    }
  }

  imageSet.images = imgs;
  return imageSet;
}

async function _deduplicate2(imageSet: ImageSet) {
  let imgs: Image[] = [];
  let images = imageSet.images;
  let hashTable = {};

  const tree = new BKTree(256);
  
  for (let i = 0; i < images.length; i++) {
    const similars: {found: string, distance: number}[] = [];
    tree.query(images[i].hash, 2, (found, distance) => {
      similars.push({found, distance});
    })
    let dup_flag = false;
    for (let j = 0; j < similars.length; j++) {
      const similar_img = hashTable[similars[j].found];
      if (await isSamePrompt(imgs[similar_img], images[i])) {
        dup_flag = true;
        imgs[similar_img] = mergeImage(imgs[similar_img], images[i]);
        break;
      }
    }
    if (!dup_flag) {
      tree.add(images[i].hash);
      hashTable[images[i].hash] = imgs.length;
      imgs.push(images[i]);
    }
  }

  imageSet.images = imgs;
  return imageSet;
}

export async function deduplicate(imageSet: ImageSet):Promise<ImageSet> {
  return _deduplicate2(await _deduplicate1(imageSet));
}

export function intersection(a: ImageSet, b: ImageSet) {
  const c = union(a, b);
  c.images = c.images.filter(image => image.duplicate_paths && image.duplicate_paths.length >= 1)
  return c;
}

export function union(a: ImageSet, b: ImageSet) {
  const c: ImageSet = {
    images: a.images.concat(b.images),
  }
  deduplicate(c);
  return c;
}

export async function getImageSet(directory?: string): Promise<ImageSet> {
  let imageSet: ImageSet = { images: [] };
  if (pathExistsSync(join(directory, "data.json"))){
    imageSet =  readJSONSync(join(directory, "data.json")); 
    if (directory) {
      const alive = readdirSync(directory).map(p => join(directory, p));
      imageSet.images = imageSet.images.filter(image => alive.includes(image.path));
    }
  }
  const paths = imageSet.images.map(image => image.path);

  if (directory) {
    const new_images = await Promise.all(
      readdirSync(directory)
        .filter(isImage)
        .map(p => join(directory, p))
        .filter(p => !paths.includes(p))
        .map(p => getImage(p))
    );
    new_images.forEach(image => console.log(chalk.green('add image'), image.path));
    imageSet = union(imageSet, { images: new_images })
  }

  deleteDuplicate(imageSet);

  writeJSONSync(join(directory, "data.json"), imageSet);
  return imageSet;
}
