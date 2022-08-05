import { aws_ecr, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class Cluster extends Construct {
  public readonly projectName: string = this.node.tryGetContext('projectname');
  public readonly deploymentStage: string = this.node.tryGetContext('env');
  public ecrRepo: aws_ecr.Repository;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.createEcrRepo();
  }

  private createEcrRepo(): aws_ecr.Repository {
    this.ecrRepo = new aws_ecr.Repository(this, this.projectName, {
      encryption: aws_ecr.RepositoryEncryption.KMS,
      repositoryName: this.projectName,
      removalPolicy: RemovalPolicy.DESTROY, // https://bobbyhadz.com/blog/set-deletion-policy-aws-cdk
    });

    new CfnOutput(this, 'RepoArn', { value: this.ecrRepo.repositoryArn });

    return this.ecrRepo;
  }
}
