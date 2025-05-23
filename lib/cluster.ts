import { aws_ecr, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';

export class Cluster extends Construct {
  public readonly projectName: string = this.node.tryGetContext('projectname');
  public readonly deploymentStage: string = this.node.tryGetContext('env');
  public readonly vpc: string = this.node.tryGetContext('vpc');
  public ecrRepo: aws_ecr.Repository;
  public ecsCluster: ecs.Cluster;
  public taskDefination: ecs.TaskDefinition;
  public fargateService: ecs.FargateService;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.createEcrRepo();
    this.createCluster();
    this.createTask();
    this.createService();
  }

  private createEcrRepo() {
    this.ecrRepo = new aws_ecr.Repository(this, this.projectName, {
      encryption: aws_ecr.RepositoryEncryption.KMS,
      repositoryName: this.projectName,
      removalPolicy: RemovalPolicy.DESTROY, // https://bobbyhadz.com/blog/set-deletion-policy-aws-cdk
    });

    new CfnOutput(this, 'RepoArn', { value: this.ecrRepo.repositoryArn });
  }

  private createCluster() {
    this.ecsCluster = new ecs.Cluster(this, 'ecsCluster', {
      clusterName: `${this.projectName}-${this.deploymentStage}`,
      vpc: Vpc.fromLookup(this, 'myVPC', { vpcId: this.vpc }),
    });
  }

  private createTask() {
    this.taskDefination = new ecs.TaskDefinition(this, 'task', {
      compatibility: ecs.Compatibility.EC2_AND_FARGATE,
      cpu: '256',
      memoryMiB: '512',
      networkMode: ecs.NetworkMode.AWS_VPC,
      family: `${this.projectName}-express-${this.deploymentStage}`,
    });

    this.taskDefination.addContainer('container', {
      containerName: `${this.projectName}-express-${this.deploymentStage}`,
      memoryLimitMiB: 512,
      environment: {
        hello: 'world',
      },
      image: ecs.RepositoryImage.fromEcrRepository(this.ecrRepo, 'latest'),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: `${this.projectName}-express-${this.deploymentStage}`,
        logGroup: new LogGroup(this, 'loggroup', { logGroupName: `${this.projectName}-${this.deploymentStage}`, removalPolicy: RemovalPolicy.DESTROY }),
      }),
      portMappings: [{ containerPort: 3000 }],
    });
  }

  private createService() {
    this.fargateService = new ecs.FargateService(this, 'service', {
      serviceName: `${this.projectName}-express-${this.deploymentStage}`,
      taskDefinition: this.taskDefination,
      desiredCount: 1,
      cluster: this.ecsCluster,
      assignPublicIp: true,
    });
  }
}
