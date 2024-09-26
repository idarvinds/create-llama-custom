import { expect, test } from "@playwright/test";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import { TemplateFramework, TemplateVectorDB } from "../helpers/types";
import { createTestDir, runCreateLlama } from "./utils";

const execAsync = util.promisify(exec);

const templateFramework: TemplateFramework = process.env.FRAMEWORK
  ? (process.env.FRAMEWORK as TemplateFramework)
  : "nextjs";
const dataSource: string = process.env.DATASOURCE
  ? process.env.DATASOURCE
  : "--example-file";

if (
  templateFramework == "nextjs" ||
  templateFramework == "express" // test is only relevant for TS projects
) {
  const llamaParseOptions = [true, false];
  // vectorDBs combinations to test
  const vectorDbs: TemplateVectorDB[] = [
    "mongo",
    "pg",
    "qdrant",
    "pinecone",
    "milvus",
    "astra",
    "chroma",
    "llamacloud",
    "weaviate",
  ];

  test.describe("Test resolve TS dependencies", () => {
    for (const llamaParseOpt of llamaParseOptions) {
      for (const vectorDb of vectorDbs) {
        const optionDescription = `vectorDb: ${vectorDb}, dataSource: ${dataSource}, llamaParse: ${llamaParseOpt}`;

        test(`options: ${optionDescription}`, async () => {
          const cwd = await createTestDir();

          const result = await runCreateLlama({
            cwd: cwd,
            templateType: "streaming",
            templateFramework: templateFramework,
            dataSource: dataSource,
            vectorDb: vectorDb,
            port: 3000,
            externalPort: 8000,
            postInstallAction: "none",
            templateUI: undefined,
            appType: templateFramework === "nextjs" ? "" : "--no-frontend",
            llamaCloudProjectName: undefined,
            llamaCloudIndexName: undefined,
            tools: undefined,
            useLlamaParse: llamaParseOpt,
          });
          const name = result.projectName;

          // Check if the app folder exists
          const appDir = path.join(cwd, name);
          const dirExists = fs.existsSync(appDir);
          expect(dirExists).toBeTruthy();

          // Install dependencies using pnpm
          try {
            const { stderr: installStderr } = await execAsync(
              "pnpm install --prefer-offline",
              {
                cwd: appDir,
              },
            );
            expect(installStderr).toBeFalsy();
          } catch (error) {
            console.error("Error installing dependencies:", error);
            throw error;
          }

          // Run tsc type check and capture the output
          try {
            const { stdout, stderr } = await execAsync(
              "pnpm exec tsc -b --diagnostics",
              {
                cwd: appDir,
              },
            );
            // Check if there's any error output
            expect(stderr).toBeFalsy();

            // Log the stdout for debugging purposes
            console.log("TypeScript type-check output:", stdout);
          } catch (error) {
            console.error("Error running tsc:", error);
            throw error;
          }
        });
      }
    }
  });
}