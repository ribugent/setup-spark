import * as core from '@actions/core';
import * as toolCache from '@actions/tool-cache';
import { execSync } from 'child_process';
import * as fs from 'fs'

// See docs to create JS action: https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action

async function main() {
  const sparkVersion = core.getInput('spark-version');
  var sparkUrl = core.getInput('spark-url');
  const hadoopVersion = core.getInput('hadoop-version');
  const scalaVersion = core.getInput('scala-version');
  const py4jVersion = core.getInput('py4j-version');

  // Try to write to the parent folder of the workflow workspace
  const workspaceFolder: string = process.env.GITHUB_WORKSPACE || '/home/runner/work'
  let installFolder: any = workspaceFolder.split("/").slice(0, -1).join('/')
  try {
    fs.accessSync(installFolder, fs.constants.R_OK);
  } catch (err) {
    console.log(`${new Date().toLocaleTimeString('fr-FR')} - Using $GITHUB_WORKSPACE to store Spark (${installFolder} not writable)`);
    installFolder = workspaceFolder
  }
  console.log(`${new Date().toLocaleTimeString('fr-FR')} - Spark will be installed to ${installFolder}`);

  // Download Spark from the official Apache mirrors
  let scalaBit = "";
  if (scalaVersion) {
    scalaBit = `-scala${scalaVersion}`
  }
  if (!sparkUrl) {
    sparkUrl = `https://archive.apache.org/dist/spark/spark-${sparkVersion}/spark-${sparkVersion}-bin-hadoop${hadoopVersion}${scalaBit}.tgz`
  }

  console.log(`${new Date().toLocaleTimeString('fr-FR')} - Downloading the binary from ${sparkUrl}`);
  const sparkTarPath = await toolCache.downloadTool(sparkUrl);
  const sparkExtractedFolder = await toolCache.extractTar(sparkTarPath, installFolder);
  const cachedPath = await toolCache.cacheDir(sparkExtractedFolder, 'spark', `${sparkVersion}-bin-hadoop${hadoopVersion}${scalaBit}`);
  core.addPath(cachedPath);
  fs.symlinkSync("${installFolder}/spark-${sparkVersion}-bin-hadoop${hadoopVersion}${scalaBit}", `${installFolder}/spark`)

  if (!fs.existsSync(`${installFolder}/spark/bin/spark-submit`)) {
    throw new Error(`The Spark binary was not properly downloaded from ${sparkUrl}`);
  }

  console.log(`${new Date().toLocaleTimeString('fr-FR')} - Binary downloaded, setting up environment variables`);

  const sparkHome = installFolder + '/spark';
  const SPARK_OPTS = `--driver-java-options=-Xms1024M --driver-java-options=-Xmx2048M --driver-java-options=-Dlog4j.logLevel=info`
  const PYTHONPATH = `${sparkHome}/python:${sparkHome}/python/lib/py4j-${py4jVersion}-src.zip`;
  const PYSPARK_PYTHON = 'python';

  // Set environment variables in the workflow
  core.exportVariable('SPARK_HOME', sparkHome);
  core.exportVariable('HADOOP_VERSION', hadoopVersion);
  core.exportVariable('APACHE_SPARK_VERSION', sparkVersion);
  core.exportVariable('PYSPARK_PYTHON', PYSPARK_PYTHON);
  core.exportVariable('PYSPARK_DRIVER_PYTHON', PYSPARK_PYTHON);
  core.exportVariable('PYTHONPATH', PYTHONPATH);
  core.exportVariable('SPARK_OPTS', SPARK_OPTS);

  // Add Spark to path
  core.addPath(`${sparkHome}/bin`);

  core.setOutput("spark-version", sparkVersion);
}

main().catch(error => {
  console.log(`\n${new Date().toLocaleTimeString('fr-FR')} - Issue installing Spark: check if the Spark version and Hadoop versions you are using is part of the one proposed in the Spark download page at https://spark.apache.org/downloads.html`)
  console.log(error);
  // @ts-ignore
  core.setFailed(error.message);
})
