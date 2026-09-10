import SwiftUI

struct ContentView: View {
    @State private var server = "http://192.168.1.102:5000"
    @State private var mrn = ""
    @State private var givenEn = ""
    @State private var familyEn = ""
    @State private var dob = ""
    @State private var sex = "M"
    @State private var phone = ""
    @State private var city = "Beirut"
    @State private var status = ""
    @State private var token = UserDefaults.standard.string(forKey: "emr_token") ?? ""

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Server")) {
                    TextField("http://192.168.1.102:5000", text: $server)
                        .autocapitalization(.none)
                    SecureField("Token (from login)", text: $token)
                    Button("Login as dr.ihab") { login() }
                }
                Section(header: Text("New Patient")) {
                    TextField("MRN *", text: $mrn)
                    TextField("Given name (EN) *", text: $givenEn)
                    TextField("Family name (EN) *", text: $familyEn)
                    TextField("DOB YYYY-MM-DD", text: $dob)
                    Picker("Sex", selection: $sex) {
                        Text("M").tag("M"); Text("F").tag("F")
                    }.pickerStyle(SegmentedPickerStyle())
                    TextField("Phone", text: $phone)
                    TextField("City", text: $city)
                }
                Button(action: addPatient) {
                    HStack { Spacer(); Text("＋ Add Patient").bold(); Spacer() }
                }
                if !status.isEmpty {
                    Section { Text(status).font(.footnote).foregroundColor(.secondary) }
                }
            }
            .navigationTitle("EyeClinic — Add Patient")
        }
    }

    func login() {
        guard let url = URL(string: server + "/api/login") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["username":"dr.ihab","password":"demo123"])
        URLSession.shared.dataTask(with: req) { data, _, _ in
            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String:Any],
                  let tok = json["token"] as? String else {
                DispatchQueue.main.async { status = "Login failed" }; return
            }
            DispatchQueue.main.async {
                token = tok
                UserDefaults.standard.set(tok, forKey: "emr_token")
                status = "Logged in ✓"
            }
        }.resume()
    }

    func addPatient() {
        guard !mrn.isEmpty, !givenEn.isEmpty, !familyEn.isEmpty else {
            status = "MRN, given & family names required"; return
        }
        guard let url = URL(string: server + "/api/patients") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let body: [String:Any] = [
            "mrn": mrn, "name_given_en": givenEn, "name_family_en": familyEn,
            "dob": dob, "sex": sex, "phone": phone, "city": city, "preferred_language": "en"
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: req) { data, resp, _ in
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
            DispatchQueue.main.async {
                if code == 201 { status = "Patient \(mrn) added ✓ — appears on desktop instantly" }
                else { status = "Failed \(code): \(String(data: data ?? Data(), encoding: .utf8) ?? "")" }
            }
        }.resume()
    }
}
