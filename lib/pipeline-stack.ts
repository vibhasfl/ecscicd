import { Cluster } from './cluster';
import { aws_cloudtrail, Duration, SecretValue, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { CodeBuildAction, EcsDeployAction, GitHubSourceAction, GitHubTrigger, S3SourceAction, S3Trigger } from 'aws-cdk-lib/aws-codepipeline-actions';
import { BuildSpec } from 'aws-cdk-lib/aws-codebuild';
import { Bucket } from 'aws-cdk-lib/aws-s3';

type PipelineProps = {
  cluster: Cluster;
};
export class PipelineStack extends Construct {
  public readonly projectName: string = this.node.tryGetContext('projectname');
  public readonly deploymentStage: string = this.node.tryGetContext('env');
  public readonly ecrRepoUrl: string;

  constructor(scope: Construct, id: string, props: PipelineProps) {
    super(scope, id);

    console.log(props?.cluster.ecrRepo.repositoryUri);

    this.ecrRepoUrl = props.cluster.ecrRepo.repositoryUri;

    const pipeline = new codepipeline.Pipeline(this, `${this.projectName}-${this.deploymentStage}`, {
      pipelineName: `${this.projectName}-${this.deploymentStage}`,
      crossAccountKeys: false,
    });

    // const codebaseSourceArtifacts = new codepipeline.Artifact();

    // const gitHubSourceAction = new GitHubSourceAction({
    //   actionName: 'DownloadSourceCode',
    //   owner: 'vibhasfl',
    //   repo: 'cicddemoapps',
    //   oauthToken: SecretValue.secretsManager('github', { jsonField: 'githuboauthtoken' }),
    //   branch: 'dev',
    //   output: codebaseSourceArtifacts,
    //   // trigger: GitHubTrigger.NONE,
    // });

    // pipeline.addStage({
    //   stageName: 'Source',
    //   actions: [gitHubSourceAction],
    // });

    // new codebuild.GitHubSourceCredentials(this, 'CodeBuildGitHubCreds', {
    //   accessToken: SecretValue.secretsManager('github', { jsonField: 'githuboauthtoken' }),
    // });

    const trail = new aws_cloudtrail.Trail(this, 'CloudTrail');
    trail.addS3EventSelector([{ bucket: Bucket.fromBucketArn(this, 's3SourceCodeBucketevent', 'arn:aws:s3:::utlron-codebase'), objectPrefix: 'dev/latest.zip' }], {
      readWriteType: aws_cloudtrail.ReadWriteType.WRITE_ONLY,
    });

    const codebaseSourceArtifacts = new codepipeline.Artifact();
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new S3SourceAction({
          actionName: 'DownloadSourceCodeFromS3',
          bucket: Bucket.fromBucketArn(this, 's3SourceCodeBucket', 'arn:aws:s3:::utlron-codebase'),
          bucketKey: 'dev/latest.zip',
          output: codebaseSourceArtifacts,
          trigger: S3Trigger.EVENTS,
        }),
      ],
    });

    const buildStageArtifacts = new codepipeline.Artifact();

    const codeBuildProject = new codebuild.PipelineProject(this, `${this.projectName}-codebld-${this.deploymentStage}`, {
      projectName: `${this.projectName}-codebld-${this.deploymentStage}`,
      buildSpec: BuildSpec.fromSourceFilename('codebuild.yml'),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true,
      },
      environmentVariables: {
        REPOSITORY_URI: { value: this.ecrRepoUrl },
        ACCOUNT_REGION: { value: Stack.of(this).region },
        ACCOUNT_ID: { value: Stack.of(this).account },
        IMAGE_NAME: { value: this.projectName },
        STAGE: { value: this.deploymentStage },
        CONTAINER_NAME: { value: `${this.projectName}-express-${this.deploymentStage}` },
      },
      timeout: Duration.minutes(10),
    });

    props.cluster.ecrRepo.grantPullPush(codeBuildProject.grantPrincipal);

    const DockerBuild = new CodeBuildAction({
      actionName: 'Dockerbuild',
      input: codebaseSourceArtifacts,
      outputs: [buildStageArtifacts],
      project: codeBuildProject,
    });

    pipeline.addStage({
      stageName: 'Build',
      actions: [DockerBuild],
    });

    const ecsDeployAction = new EcsDeployAction({
      actionName: 'ECSDeploy',
      service: props.cluster.fargateService,
      input: buildStageArtifacts,
    });
    pipeline.addStage({
      stageName: 'Deploy',
      actions: [ecsDeployAction],
    });
  }
}
