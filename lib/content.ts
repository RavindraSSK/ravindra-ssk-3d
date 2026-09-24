// All site copy lives here — edit this file to update content.
// Sources: resume (latest) + ravindrassk.com.

export const profile = {
  name: "Ravindra SSK",
  fullName: "Ravindra Siva Sai Kumar Medicharla",
  role: "AI/ML Engineer",
  tagline: "I build and evaluate production ML & AI systems.",
  location: "St. Louis, MO",
  status: "Open to ML & AI roles",
  email: "ravindrassk1304@gmail.com",
  mainSite: "https://ravindrassk.com",
  /** Living-photo loop for the About card, e.g. "/images/portrait-loop.mp4". null = still photo. */
  portraitVideo: null as string | null,
  links: {
    linkedin: "https://www.linkedin.com/in/ravindra-ssk-medicharla-45ba44123/",
    github: "https://github.com/RavindraSSK",
    researchgate: "https://www.researchgate.net/profile/Ravindra-Ssk-Medicharla",
    portfolio: "https://ravindrassk.com/portfolio",
  },
};

export const about = {
  kicker: "01 — About",
  title: "Engineer by training. Researcher by habit.",
  body: [
    "I'm an AI/ML engineer finishing my M.S. in Artificial Intelligence at Saint Louis University. I build machine learning systems end to end — data pipelines and feature engineering, model training in PyTorch, containerized inference APIs, and cloud deployment with CI/CD and monitoring.",
    "Right now I evaluate frontier LLMs and coding agents, build a vision-language model benchmark as a research assistant at SLU, and lead a capstone on uncertainty-gated model routing for LLM tool calling. Before that: deep learning on satellite imagery and an explainable clinical AI platform.",
  ],
  stats: [
    { value: "3.83", label: "GPA · M.S. AI" },
    { value: "3+", label: "Years applied ML & stats" },
    { value: "6+", label: "Certifications" },
    { value: "3", label: "Awards & scholarships" },
  ],
};

export type Job = {
  role: string;
  org: string;
  meta: string;
  period: string;
  points: string[];
};

export const experience: Job[] = [
  {
    role: "AI Trainer — LLM & Coding-Agent Evaluation",
    org: "Handshake AI",
    meta: "Contract · Remote",
    period: "Apr 2026 — Present",
    points: [
      "Evaluate frontier LLMs and coding agents on multi-step software-engineering tasks: reasoning, code generation, debugging and tool use.",
      "Design evaluation tasks, scoring rubrics and reproducible test cases that expose failure modes.",
      "Validate generated code with automated tests in containerized environments and analyze regressions across model runs.",
    ],
  },
  {
    role: "Research Assistant — Multimodal (VLM) Evaluation",
    org: "TRACE AI Lab, Saint Louis University",
    meta: "St. Louis, MO",
    period: "Sep 2026 — Present",
    points: [
      "Building a controlled photo–caption benchmark that tests whether vision-language models attribute event actors to image evidence or caption evidence.",
      "Designed annotation guidelines and a two-annotator validation with Cohen's kappa as the pilot gate before scaling collection.",
      "Evaluating open VLMs (Qwen3-VL, InternVL) served via vLLM, scoring abstention, unsupported attribution and fabricated evidence with cluster-bootstrap CIs.",
    ],
  },
  {
    role: "Graduate Researcher — Deep Learning & Computer Vision",
    org: "AI-CHESS Lab, Saint Louis University",
    meta: "St. Louis, MO",
    period: "Nov 2025 — Mar 2026",
    points: [
      "Compared CNN, GAN and attention-based architectures in PyTorch for satellite imagery analysis.",
      "Built a reproducible training & evaluation workflow — geospatial preprocessing, GPU training, checkpointing, experiment tracking.",
      "Investigated shadow removal, image enhancement and attention mechanisms for downstream feature quality.",
    ],
  },
  {
    role: "Applied Statistics Specialist",
    org: "Chegg India",
    meta: "Remote",
    period: "Apr 2021 — Nov 2024",
    points: [
      "Delivered 500+ rigorous quantitative solutions across probability, inference and predictive modeling in R and Minitab.",
      "Recognized as “Quality Champ” with a top accuracy rating across the full tenure.",
    ],
  },
  {
    role: "Research Intern — IAS Summer Research Fellow",
    org: "IIT Bombay",
    meta: "Mumbai, India",
    period: "Jun 2019 — Aug 2019",
    points: [
      "Selected through a competitive national fellowship to research terrestrial laser scanning and 3D point clouds.",
      "Implemented multi-scan registration with ICP, outlier removal, voxel downsampling and RANSAC segmentation.",
    ],
  },
];

export type Project = {
  id: "uqroute" | "meditrust" | "campus" | "gundata" | "snaptune";
  title: string;
  subtitle: string;
  year: string;
  status?: string;
  description: string;
  metrics: string[];
  stack: string[];
  href: string;
};

export const projects: Project[] = [
  {
    id: "uqroute",
    title: "UQRoute",
    subtitle: "Uncertainty-gated small-model routing for LLM tool calling",
    year: "Sep 2026 — M.S. Capstone",
    status: "In progress",
    description:
      "Serves tool-calling requests with small open-weight models and escalates only the uncertain calls to a 14B fallback. Confidence comes from token log-probabilities and multi-sample tool-call disagreement. The goal is 20% lower cost per successful task while keeping 95% of the 14B model's success rate.",
    metrics: ["Target −20% cost", "≥95% of 14B success", "3,721 eval cases"],
    stack: ["Python", "PyTorch", "vLLM", "Qwen2.5 / Llama-3.2", "LangGraph", "MCP", "FastAPI"],
    href: "https://github.com/RavindraSSK",
  },
  {
    id: "meditrust",
    title: "MediTrust",
    subtitle: "Explainable AI clinical risk prediction platform",
    year: "Spring 2026",
    description:
      "Full-stack cardiovascular risk platform with FastAPI model serving, role-based access and per-patient SHAP attributions. A RAG layer grounds LLM explanations alongside, but strictly separate from, the model's risk score.",
    metrics: ["ROC-AUC 0.87", "SHAP per patient", "AWS + CI/CD"],
    stack: ["FastAPI", "React", "PostgreSQL", "XGBoost", "SHAP", "AWS"],
    href: "https://github.com/RavindraSSK/MediTrust",
  },
  {
    id: "campus",
    title: "Campus-Objects",
    subtitle: "Multi-class object detection with LW-DETR",
    year: "Fall 2025",
    description:
      "Collected and annotated a custom 3,000+ image dataset across 8 categories, trained an LW-DETR detector with transfer learning, and built class-wise error-analysis tooling to diagnose failure modes.",
    metrics: ["0.71 mAP@0.5", "3,000+ images", "8 classes"],
    stack: ["PyTorch", "LW-DETR", "COCO", "Augmentation"],
    href: "https://github.com/RavindraSSK",
  },
  {
    id: "gundata",
    title: "Gundata: Agentic AI",
    subtitle: "Traditional dice game rebuilt as an agent testbed",
    year: "2025",
    description:
      "A traditional Andhra Pradesh dice game turned reinforcement-learning playground, moving from rule-based play to a Q-learning opponent trained through self-play.",
    metrics: ["18-state MDP", "20,000 self-play episodes"],
    stack: ["Java", "Q-Learning", "Reinforcement Learning"],
    href: "https://github.com/RavindraSSK/gundata-agentic-ai",
  },
  {
    id: "snaptune",
    title: "Snap Tune",
    subtitle: "Multi-modal music recommender",
    year: "2025",
    description:
      "Upload a photo and get a playlist. Image captioning plus mood inference turns what the camera sees into music recommendations through the Spotify API.",
    metrics: ["Image → mood → music", "Streamlit app"],
    stack: ["BLIP", "DistilGPT2", "Spotify API", "Streamlit"],
    href: "https://github.com/RavindraSSK/snaptune-streamlit",
  },
];

export const research = [
  {
    tag: "Multimodal · 2026 —",
    title: "Evidence attribution in VLMs",
    body: "Do vision-language models credit the right source? A controlled photo–caption benchmark with a pre-registered protocol that checks whether VLMs take event actors from the image or the caption, and when they make evidence up.",
    where: "TRACE AI Lab",
  },
  {
    tag: "Computer Vision · 2025–26",
    title: "Shadow removal in satellite imagery",
    body: "CNN, GAN and attention-based models for restoring shadowed regions in aerial imagery, and measuring how that restoration changes downstream feature quality.",
    where: "AI-CHESS Lab",
  },
  {
    tag: "3D · 2019",
    title: "Terrestrial laser scanning",
    body: "Multi-scan point-cloud registration with ICP and RANSAC. The terrain behind this text is a nod to that work.",
    where: "IIT Bombay",
  },
];

export type Honor = { title: string; org: string; detail?: string; year?: string; icon: "fellowship" | "quality" | "scholarship" | "captain" | "concrete" | "service" };

export const awards: Honor[] = [
  { title: "IAS Summer Research Fellowship", org: "IIT Bombay", year: "2019", icon: "fellowship" },
  { title: "Quality Champ", org: "Chegg India", icon: "quality" },
  { title: "Mahatma Gandhi Scholarship", org: "Vel Tech", detail: "75% tuition waiver (B.Tech)", icon: "scholarship" },
];

export const leadership: Honor[] = [
  { title: "Captain, university handball team", org: "All India University South Zone Tournament", year: "2018", icon: "captain" },
  { title: "Student Coordinator", org: "Indian Concrete Institute", icon: "concrete" },
  { title: "NSS Volunteer", org: "National Service Scheme", icon: "service" },
];

// Order matches the 6 particle clusters in the 3D scene.
export const skillGroups = [
  { name: "Languages", items: ["Python", "SQL", "R", "Bash"] },
  {
    name: "ML & Deep Learning",
    items: ["PyTorch", "TensorFlow", "Transformers", "Scikit-learn", "XGBoost", "SHAP", "Calibration (AUROC, ECE)"],
  },
  {
    name: "LLMs & GenAI",
    items: ["LLM & agent evaluation", "Tool calling", "Uncertainty & routing", "vLLM", "LangGraph", "MCP", "VLM evaluation", "RAG"],
  },
  {
    name: "Computer Vision",
    items: ["OpenCV", "Object detection", "Geospatial imagery", "Point clouds (ICP, RANSAC)"],
  },
  {
    name: "MLOps",
    items: ["Docker", "AWS", "FastAPI", "GitHub Actions", "pytest", "CUDA"],
  },
  {
    name: "Data & Statistics",
    items: ["PostgreSQL", "Pandas", "NumPy", "Hypothesis testing", "Cohen's kappa", "Cluster bootstrap"],
  },
];

export const certifications = [
  "AWS Certified ML Engineer – Associate",
  "Microsoft Azure AI Engineer (AI-102)",
  "NVIDIA DLI — Accelerated Computing with CUDA Python",
  "NVIDIA DLI — Deploying RAG Pipelines at Scale",
  "IBM Data Science",
  "Anthropic AI Fluency",
];

export const chapters = [
  { id: "hero", label: "Intro" },
  { id: "about", label: "About" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "research", label: "Research" },
  { id: "skills", label: "Skills" },
  { id: "contact", label: "Contact" },
] as const;
