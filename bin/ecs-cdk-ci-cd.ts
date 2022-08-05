#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EcsCdkCiCdStack } from '../lib/ecs-cdk-ci-cd-stack';
import { Tags } from 'aws-cdk-lib';

const app = new cdk.App();

const projectName = process.env.PROJECT_NAME || app.node.tryGetContext('projectname');
const stage = process.env.DEPLOYMENT_ENV || app.node.tryGetContext('env');

const myStack = new EcsCdkCiCdStack(app, `${projectName}-${stage}`, {
  stackName: `${projectName}-${stage}`,
  env: { region: 'ap-south-1' },
});

Tags.of(myStack).add('projectname', `${projectName}`);
Tags.of(myStack).add('env', `${stage}`);
