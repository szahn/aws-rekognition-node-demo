const AWS = require('aws-sdk');
const path = require("path");
const fs = require("fs");

const BUCKET_NAME = `rekognition-demo-1`;

function getImageMetadata(){
  return new Promise((resolve, reject)=>{

    const imagesPath = path.join(__dirname, "../client/photos/");
    console.log(`Reading images from ${imagesPath}`);

    fs.readdir(imagesPath, function(err, items) {  
      if (err){
        console.log(err, err.stack);
        reject(err);
        return;
      }

      resolve(items.map((i)=>{
        return {
          id : path.basename(i).toLocaleLowerCase(),
          filename: path.join(imagesPath, i)
        };
      }));

    });

  });
}

function getBucketObjectKeys(bucketName){
  const s3 = new AWS.S3();
  return new Promise((resolve, reject)=>{
    s3.listObjects({Bucket: bucketName, MaxKeys: 1000}, (err, data)=>{
      if (err){
        console.log(err, err.stack);
        reject(err);
        return;
      }

      resolve(data.Contents.map(c => c.Key));
    });
  });
}

function createIfNotExistsBucket(bucketName){
  const s3 = new AWS.S3();
  return new Promise((resolve, reject)=>{
    s3.listBuckets({}, (err, data)=>{
      if (err) {
        console.log(err, err.stack);
        reject(err);
        return;
      }

      console.log(`${data.Buckets.length} buckets`);
      for(const b of data.Buckets){
        if (b.Name === bucketName){
          console.log(`S3 Bucket ${bucketName} exists.`);
          getBucketObjectKeys(bucketName).then(resolve);
          return;
        }
      }

      const createOpts = {Bucket: bucketName, "ACL": "private", CreateBucketConfiguration: {LocationConstraint: "us-west-2"}};
      s3.createBucket(createOpts, (err, data)=>{
        if (err){
          console.log(err, err.stack);
          reject(err);
          return;
        }

        console.log(`Created S3 bucket ${bucketName}`);
        resolve([]);
      });

    });
  });
}

function readImage(filename){
  return new Promise((resolve, reject)=>{
    console.log(`Reading ${filename}`);
    const readable = fs.createReadStream(filename);
    const chunks = [];
    readable.on("data", (chunk)=>{
      chunks.push(chunk);
    }).on("error", (err) => {
      reject(err);
    }).on("end", _ => {
      const buffer = Buffer.concat(chunks);
      console.log(`Read ${buffer.length/1024} kb from image ${filename}.`);
      resolve(buffer);
    });    
  });
}

function uploadImage(bucketName, imageBuffer, imageMeta){
  const s3 = new AWS.S3();
  return new Promise((resolve, reject)=>{
    s3.upload({Bucket: BUCKET_NAME, Key: imageMeta.id, Body: imageBuffer}, (err, data)=>{
      if (err){
        console.log(err, err.stack);
        reject(err);
        return;
      }

      console.log(`Uploaded ${imageMeta.id} to bucket ${bucketName}`);
      resolve(data);
    });  
  });
}

function recognize(bucketName, imageMeta){
  return new Promise((resolve, reject)=>{
    const rek = new AWS.Rekognition();
    rek.detectLabels({
      Image: {
        S3Object: {
          Bucket: bucketName, 
          Name: imageMeta.id
        }
      },
      MaxLabels: 24,
      MinConfidence: 60
    }, (err, data) => {
      if (err){
        console.log(err, err.stack);
        reject(err);
        return;
      }

      const labels = data.Labels.map(l => l.Name);
      console.log(`${imageMeta.id}: ${labels.join(", ")}`)
      resolve(labels);
    });
  });
}

function saveLabeledImages(labeledImages){
  return new Promise((resolve, reject) =>  {
    fs.writeFile(path.join(__dirname, "../client/", "labels.json"), JSON.stringify(labeledImages), (err)=>{
      if (err){
        console.log(err);
        reject(err);
      }

      resolve();
    });
  });
}

function processImages(images, bucketObjectKeys){
  return Promise.all(images.map((imageMeta) => new Promise((resolve, reject)=>{

    if (bucketObjectKeys.indexOf(imageMeta.id) >= 0){
      console.log(`Image ${imageMeta.id} already exists.`);
      resolve();
      return;
    };
    
    return readImage(imageMeta.filename)
      .then(imgBuffer => uploadImage(BUCKET_NAME, imgBuffer, imageMeta))
      .then(resolve)
      .catch(err => {
        reject(err);
      });

  }))).then(_=> images);
}

function labelImages(images){
  return Promise.all(images.map(imageMeta => 
    recognize(BUCKET_NAME, imageMeta)
    .then(data => {return {filename: path.basename(imageMeta.filename), id: imageMeta.id, labels: data}})));
}


/*
Create an S3 bucket if one doesn't exist
Upload all images to the S3 bucket. 
Only upload images that don't already exist.
Recognize labels for each image
*/

Promise.all([getImageMetadata(), createIfNotExistsBucket(BUCKET_NAME)]).then((results)=>{
  const [images, bucketObjectKeys] = results;

  return processImages(images, bucketObjectKeys)
    .then(labelImages)
    .then(saveLabeledImages)
    .then(_=> {
      console.log("done!");
    });

}).catch(err => {
    console.log(err);
});