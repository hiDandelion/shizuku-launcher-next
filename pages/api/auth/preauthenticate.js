import clientPromise from "../../../lib/mongodb";
import { generateAuthenticationOptions } from '@simplewebauthn/server';

export default async function handler(req, res) {
    try {
        const client = await clientPromise;
        const db = client.db("shizuku_launcher_development");

        const user = await db
            .collection("users")
            .findOne({
                username: req.body.username
            });

        if (!user) {
            throw new Error("User Not Existed");
        }

        const options = generateAuthenticationOptions({
            userVerification: 'preferred',
        });

        db
            .collection("users")
            .updateOne({
                username: req.body.username
            }, {
                $set: {
                    challenge: options.challenge
                }
            });

        return res.status(200).send(options);
    } catch (err) {
        return res.status(500).send({
            error: {
                message: err.message
            }
        });
    }
}
