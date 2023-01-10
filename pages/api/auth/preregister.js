import clientPromise from "../../../lib/mongodb";
import { generateRegistrationOptions } from '@simplewebauthn/server';

const domain = "shizuku-launcher-next-git-dev-hidandelion.vercel.app";
const appName = "Shizuku Launcher";

export default async function handler(req, res) {
    try {
        const client = await clientPromise;
        const db = client.db("shizuku_launcher_development");

        const user = await db
            .collection("users")
            .findOne({
                username: req.body.username
            });

        if (user) {
            throw new Error("User Existed");
        }

        const options = generateRegistrationOptions({
            rpID: domain,
            rpName: appName,
            userID: req.body.username,
            userName: req.body.username,
            attestationType: 'none',
            authenticatorSelection: {
                userVerification: 'preferred',
            }
        });

        db
            .collection("users")
            .insertOne({
                username: req.body.username,
                challenge: options.challenge
            })

        return res.status(200).send(options);
    } catch (err) {
        return res.status(500).send({
            error: {
                message: err.message
            }
        });
    }
}
