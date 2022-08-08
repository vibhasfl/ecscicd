#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';
import { Cluster } from '../lib/cluster';
import { Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';

const app = new cdk.App();

const projectName = process.env.PROJECT_NAME || app.node.tryGetContext('projectname');
const stage = process.env.DEPLOYMENT_ENV || app.node.tryGetContext('env');
const accountno = process.env.ACCOUNT_ID || app.node.tryGetContext('accountno');
const region = process.env.ACCOUNT_REGION || app.node.tryGetContext('region');

class UltronStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const cluster = new Cluster(this, 'ecs-cluster');
    new PipelineStack(this, 'pipeline-stack', {
      cluster: cluster,
    });
  }
}

const myStack = new UltronStack(app, `${projectName}-${stage}`, {
  stackName: `${projectName}-${stage}`,
  env: { region: region, account: accountno },
});

Tags.of(myStack).add('projectname', `${projectName}`);
Tags.of(myStack).add('env', `${stage}`);

// VPC
// ECS Cluster
// ECR Repo
// CI-CD pipeline
